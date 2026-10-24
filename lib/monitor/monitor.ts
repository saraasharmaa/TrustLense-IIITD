import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cases, findings, watches } from "@/lib/db/schema";
import { findDemoCompanyByGstin, findSnapshot } from "@/lib/demo/fixtures";
import { AppError } from "@/lib/errors";
import { emitEvent } from "@/lib/orchestrator/events";
import { runCase } from "@/lib/orchestrator/runCase";
import { loadCase } from "@/lib/orchestrator/store";
import type { AdapterId } from "@/lib/types";
import { createAlert } from "./alerts";
import { diffCases, type CaseSnapshot } from "./diff";

const SIMULATION_SNAPSHOT = "t1";

async function loadSnapshot(caseId: string): Promise<CaseSnapshot | null> {
  const { case: c } = await loadCase(caseId);
  if (c.score === null || !c.grade) return null;
  const rows = await db().select().from(findings).where(eq(findings.caseId, caseId));
  return {
    score: c.score,
    grade: c.grade as CaseSnapshot["grade"],
    findings: rows.map((f) => ({
      ruleId: f.ruleId,
      title: f.title,
      fingerprint: f.fingerprint,
      severity: f.severity,
      hardStop: f.hardStop,
    })),
  };
}

export interface MonitorOutcome {
  caseId: string;
  alertId: string | null;
}

// One monitoring pass: re-check the cheap sources, carry the rest forward, diff, alert
export async function runWatch(
  watchId: string,
  opts: { simulate?: boolean } = {},
): Promise<MonitorOutcome> {
  const [watch] = await db().select().from(watches).where(eq(watches.id, watchId));
  if (!watch) throw new AppError("not_found", "Watch not found");
  const previousId = watch.lastCaseId ?? watch.baselineCaseId;
  if (!previousId) throw new AppError("conflict", "Watch has no baseline case");
  const { case: previous, subject } = await loadCase(previousId);

  if (opts.simulate) {
    const fixture = subject.gstin ? findDemoCompanyByGstin(subject.gstin) : undefined;
    if (!fixture || !findSnapshot(fixture, SIMULATION_SNAPSHOT)) {
      throw new AppError("not_found", "No simulated change snapshot for this company");
    }
  }

  const [created] = await db()
    .insert(cases)
    .values({
      subjectId: subject.id,
      mode: opts.simulate ? "demo" : previous.mode,
      triggeredBy: opts.simulate ? "simulation" : "monitor",
      requestedSources: previous.requestedSources,
      parentCaseId: previous.id,
    })
    .returning({ id: cases.id });
  const caseId = created!.id;

  await runCase(caseId, {
    only: watch.adapters as AdapterId[],
    carryForwardFrom: previous.id,
    fresh: true,
    replay: opts.simulate ? { snapshot: SIMULATION_SNAPSHOT, delayMs: [300, 900] } : undefined,
  });

  const [before, after] = await Promise.all([loadSnapshot(previous.id), loadSnapshot(caseId)]);
  const diff = before && after ? diffCases(before, after) : null;
  const alertId = diff
    ? await createAlert({
        watchId,
        subjectId: subject.id,
        caseId,
        previousCaseId: previous.id,
        diff,
        isSimulated: Boolean(opts.simulate),
      })
    : null;
  if (alertId) await emitEvent(caseId, "alert.created", { alertId, severity: diff?.severity });

  await db()
    .update(watches)
    .set({
      lastCaseId: caseId,
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + watch.frequencyHours * 3_600_000),
    })
    .where(eq(watches.id, watchId));
  return { caseId, alertId };
}

export async function runDueWatches(): Promise<{ ran: number; alerts: number }> {
  const due = await db()
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.active, true), lte(watches.nextRunAt, new Date())));

  let alertCount = 0;
  for (const { id } of due) {
    try {
      const outcome = await runWatch(id);
      if (outcome.alertId) alertCount++;
    } catch (err) {
      console.error(
        JSON.stringify({ watchId: id, event: "monitor.failed", error: String(err).slice(0, 200) }),
      );
    }
  }
  return { ran: due.length, alerts: alertCount };
}
