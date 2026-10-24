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

// On globalThis so Next dev hot reloads don't orphan live subscribers
const globalForEvents = globalThis as unknown as {
  trustlensListeners?: Map<string, Set<Listener>>;
  trustlensWriteQueues?: Map<string, Promise<unknown>>;
};
const listeners = (globalForEvents.trustlensListeners ??= new Map<string, Set<Listener>>());
const writeQueues = (globalForEvents.trustlensWriteQueues ??= new Map<string, Promise<unknown>>());

export function subscribe(caseId: string, listener: Listener): () => void {
  const set = listeners.get(caseId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(caseId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(caseId);
  };
}

async function insertEvent(caseId: string, type: CaseEventType, data: unknown): Promise<CaseEvent> {
  // seq is assigned in the insert itself; the unique (case_id, seq) index guards against races
  const rows = await db().execute<{ seq: number; ts: Date }>(sql`
    insert into case_events (case_id, seq, type, data)
    select ${caseId}, coalesce(max(seq), 0) + 1, ${type}, ${JSON.stringify(data)}::jsonb
    from case_events where case_id = ${caseId}
    returning seq, ts`);
  const row = rows[0];
  if (!row) throw new Error("case event insert returned no row");
  return { seq: row.seq, type, ts: new Date(row.ts).toISOString(), data };
}

// Adapters run concurrently, so writes per case go through a queue to keep seq in emit order
export function emitEvent(caseId: string, type: CaseEventType, data: unknown): Promise<CaseEvent> {
  const previous = writeQueues.get(caseId) ?? Promise.resolve();
  const written = previous.then(() => insertEvent(caseId, type, data));
  writeQueues.set(
    caseId,
    written.catch(() => undefined),
  );
  return written.then((event) => {
    listeners.get(caseId)?.forEach((listener) => listener(event));
    return event;
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
