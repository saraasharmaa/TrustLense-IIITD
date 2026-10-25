import { and, eq, inArray } from "drizzle-orm";
import type { AdapterInput, SourceOutcomes } from "@/lib/adapters/types";
import { db } from "@/lib/db/client";
import { cases, findings, sourceRuns, subjects } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import type { AdapterId, Finding, Narrative, ScoreResult, SourceStatus } from "@/lib/types";

type CaseRow = typeof cases.$inferSelect;
type SubjectRow = typeof subjects.$inferSelect;

export async function loadCase(caseId: string): Promise<{ case: CaseRow; subject: SubjectRow }> {
  const [row] = await db()
    .select({ case: cases, subject: subjects })
    .from(cases)
    .innerJoin(subjects, eq(cases.subjectId, subjects.id))
    .where(eq(cases.id, caseId));
  if (!row) throw new AppError("not_found", "Case not found");
  return row;
}

export function toAdapterInput(subject: SubjectRow): AdapterInput {
  return {
    gstin: subject.gstin ?? undefined,
    pan: subject.pan ?? undefined,
    cin: subject.cin ?? undefined,
    udyamNumber: subject.udyamNumber ?? undefined,
    legalName: subject.legalName,
    tradeName: subject.tradeName ?? undefined,
    stateCode: subject.stateCode ?? undefined,
    directors: subject.directors ?? undefined,
  };
}

export async function markCaseRunning(caseId: string): Promise<void> {
  await db()
    .update(cases)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(cases.id, caseId));
}

export async function createSourceRun(
  caseId: string,
  adapter: AdapterId,
  status: SourceStatus,
  error?: string,
): Promise<string> {
  const [row] = await db()
    .insert(sourceRuns)
    .values({ caseId, adapter, status, error, startedAt: new Date() })
    .returning({ id: sourceRuns.id });
  return row!.id;
}

export interface SourceRunPatch {
  status: SourceStatus;
  attempt?: number;
  isReplay?: boolean;
  isManual?: boolean;
  durationMs?: number;
  tinyfishRunId?: string;
  evidenceUrl?: string;
  steps?: { t: string; text: string; url?: string }[];
  rawOutput?: unknown;
  normalized?: unknown;
  error?: string;
}

export async function updateSourceRun(id: string, patch: SourceRunPatch): Promise<void> {
  const finished = patch.status !== "running" && patch.status !== "pending";
  await db()
    .update(sourceRuns)
    .set({ ...patch, finishedAt: finished ? new Date() : undefined })
    .where(eq(sourceRuns.id, id));
}

export async function saveFindings(caseId: string, list: Finding[]): Promise<void> {
  if (list.length === 0) return;
  await db()
    .insert(findings)
    .values(
      list.map((f) => ({
        ...f,
        caseId,
        confidence: f.confidence.toFixed(2),
        sourceRunId: f.evidence[0]?.sourceRunId ?? null,
      })),
    );
}

export interface CaseResult {
  status: "completed" | "partial" | "failed";
  score?: ScoreResult | null;
  narrative?: Narrative;
}

export async function finishCase(caseId: string, result: CaseResult): Promise<void> {
  const score = result.score;
  await db()
    .update(cases)
    .set({
      status: result.status,
      completedAt: new Date(),
      score: score?.score,
      grade: score?.grade,
      recommendation: score?.recommendation,
      coverage: score?.coverage.toFixed(3),
      isProvisional: score?.isProvisional,
      rulesVersion: score?.rulesVersion,
      scoreResult: score ?? undefined,
      narrative: result.narrative,
    })
    .where(eq(cases.id, caseId));
}

// Reruns overwrite in place: findings are recomputed and the rerun sources get fresh runs
export async function clearForRerun(caseId: string, adapters: AdapterId[]): Promise<void> {
  await db().delete(findings).where(eq(findings.caseId, caseId));
  await db()
    .delete(sourceRuns)
    .where(and(eq(sourceRuns.caseId, caseId), inArray(sourceRuns.adapter, adapters)));
}

// Outcomes of the runs a rerun keeps, rebuilt from what was stored
export async function loadKeptOutcomes(caseId: string): Promise<SourceOutcomes> {
  const rows = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
  const outcomes: SourceOutcomes = {};
  for (const row of rows) {
    outcomes[row.adapter as AdapterId] = {
      sourceRunId: row.id,
      status: row.status,
      normalized: row.normalized ?? undefined,
      evidenceUrl: row.evidenceUrl ?? undefined,
      retrievedAt: (row.finishedAt ?? row.createdAt).toISOString(),
      isReplay: row.isReplay,
    };
  }
  return outcomes;
}

// Directors found on MCA are reused to disambiguate news and legal matches
export async function saveDirectors(
  subjectId: string,
  directors: { din?: string; name: string }[],
): Promise<void> {
  await db().update(subjects).set({ directors }).where(eq(subjects.id, subjectId));
}
