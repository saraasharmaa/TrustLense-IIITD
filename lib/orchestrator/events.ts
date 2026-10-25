import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseEvents } from "@/lib/db/schema";

export type CaseEventType =
  | "case.started"
  | "source.started"
  | "source.progress"
  | "source.completed"
  | "source.failed"
  | "finding.created"
  | "score.computed"
  | "narrative.ready"
  | "report.ready"
  | "case.failed"
  | "alert.created";

export interface CaseEvent {
  seq: number;
  type: CaseEventType;
  ts: string;
  data: unknown;
}

type Listener = (event: CaseEvent) => void;

interface Pending {
  type: CaseEventType;
  data: unknown;
  resolve: (event: CaseEvent) => void;
  reject: (err: unknown) => void;
}

interface CaseQueue {
  pending: Pending[];
  flushing: boolean;
  // Next seq to hand out; read from the database once, then counted in memory
  nextSeq?: number;
}

// On globalThis so Next dev hot reloads don't orphan live subscribers or queues
const globalForEvents = globalThis as unknown as {
  trustlensListeners?: Map<string, Set<Listener>>;
  trustlensQueues?: Map<string, CaseQueue>;
};
const listeners = (globalForEvents.trustlensListeners ??= new Map<string, Set<Listener>>());
const queues = (globalForEvents.trustlensQueues ??= new Map<string, CaseQueue>());

export function subscribe(caseId: string, listener: Listener): () => void {
  const set = listeners.get(caseId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(caseId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(caseId);
  };
}

async function writeBatch(caseId: string, queue: CaseQueue, batch: Pending[]): Promise<void> {
  if (queue.nextSeq === undefined) {
    const [row] = await db()
      .select({ max: sql<number>`coalesce(max(${caseEvents.seq}), 0)` })
      .from(caseEvents)
      .where(eq(caseEvents.caseId, caseId));
    queue.nextSeq = (row?.max ?? 0) + 1;
  }
  const first = queue.nextSeq;
  const rows = batch.map((p, i) => ({ caseId, seq: first + i, type: p.type, data: p.data }));
  // One insert for everything queued: each round trip to a remote database is slow
  const written = await db()
    .insert(caseEvents)
    .values(rows)
    .returning({ seq: caseEvents.seq, ts: caseEvents.ts });
  queue.nextSeq = first + batch.length;
  const tsBySeq = new Map(written.map((w) => [w.seq, w.ts]));
  batch.forEach((p, i) => {
    const event: CaseEvent = {
      seq: first + i,
      type: p.type,
      ts: (tsBySeq.get(first + i) ?? new Date()).toISOString(),
      data: p.data,
    };
    listeners.get(caseId)?.forEach((listener) => listener(event));
    p.resolve(event);
  });
}

async function flush(caseId: string, queue: CaseQueue): Promise<void> {
  if (queue.flushing) return;
  queue.flushing = true;
  try {
    while (queue.pending.length > 0) {
      const batch = queue.pending.splice(0);
      try {
        await writeBatch(caseId, queue, batch);
      } catch (err) {
        queue.nextSeq = undefined; // re-read from the database after a failure
        batch.forEach((p) => p.reject(err));
      }
    }
  } finally {
    queue.flushing = false;
  }
}

// Events are written in emit order, and everything queued while a write is running goes out as one batch
export function emitEvent(caseId: string, type: CaseEventType, data: unknown): Promise<CaseEvent> {
  const queue = queues.get(caseId) ?? { pending: [], flushing: false };
  queues.set(caseId, queue);
  return new Promise((resolve, reject) => {
    queue.pending.push({ type, data, resolve, reject });
    void flush(caseId, queue);
  });
}

export async function listEventsAfter(caseId: string, afterSeq: number): Promise<CaseEvent[]> {
  const rows = await db()
    .select()
    .from(caseEvents)
    .where(and(eq(caseEvents.caseId, caseId), gt(caseEvents.seq, afterSeq)))
    .orderBy(asc(caseEvents.seq));
  return rows.map((row) => ({
    seq: row.seq,
    type: row.type as CaseEventType,
    ts: row.ts.toISOString(),
    data: row.data,
  }));
}
