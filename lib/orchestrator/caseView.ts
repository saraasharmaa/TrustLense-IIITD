import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { findings, sourceRuns, watches } from "@/lib/db/schema";
import { loadCase } from "./store";

// Shape from docs/05 GET /api/cases/:id; score fields are null while the case is running
export async function getCaseView(caseId: string) {
  const { case: c, subject } = await loadCase(caseId);
  const [runs, found, [watch]] = await Promise.all([
    db()
      .select()
      .from(sourceRuns)
      .where(eq(sourceRuns.caseId, caseId))
      .orderBy(asc(sourceRuns.createdAt)),
    db().select().from(findings).where(eq(findings.caseId, caseId)),
    db().select().from(watches).where(eq(watches.subjectId, subject.id)),
  ]);
  const result = c.scoreResult;

  return {
    id: c.id,
    status: c.status,
    mode: c.mode,
    subject: {
      legalName: subject.legalName,
      gstin: subject.gstin,
      pan: subject.pan,
      cin: subject.cin,
      udyamNumber: subject.udyamNumber,
      stateCode: subject.stateCode,
      entityType: subject.entityType,
    },
    score: c.score,
    grade: c.grade,
    recommendation: c.recommendation,
    coverage: c.coverage === null ? null : Number(c.coverage),
    isProvisional: c.isProvisional,
    hardStops: result?.hardStops ?? [],
    categoryBreakdown: result?.categoryBreakdown ?? [],
    narrative: c.narrative,
    sourceRuns: runs.map((r) => ({
      id: r.id,
      adapter: r.adapter,
      status: r.status,
      isReplay: r.isReplay,
      isManual: r.isManual,
      durationMs: r.durationMs,
      attempt: r.attempt,
      error: r.error,
      tinyfishRunId: r.tinyfishRunId,
    })),
    findings: found.map((f) => ({ ...f, confidence: Number(f.confidence), caseId: undefined })),
    rulesVersion: c.rulesVersion,
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    watch: watch
      ? { id: watch.id, frequencyHours: watch.frequencyHours, active: watch.active }
      : null,
  };
}
