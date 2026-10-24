import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";
import { db } from "@/lib/db/client";
import { alerts, cases, watches } from "@/lib/db/schema";
import { runCase } from "@/lib/orchestrator/runCase";
import { createTestCase, hasDatabase } from "@/lib/testing/db";
import { runWatch } from "./monitor";

const options = { replay: { delayMs: [0, 0] as [number, number] }, backoffMs: 1 };

describe.skipIf(!hasDatabase)("runWatch", { timeout: 20_000 }, () => {
  async function watchedBaseline() {
    const caseId = await createTestCase("demo", "33AABCS7345M1Z3");
    await db().update(cases).set({ requestedSources: ADAPTER_ORDER }).where(eq(cases.id, caseId));
    await runCase(caseId, options);
    const [base] = await db().select().from(cases).where(eq(cases.id, caseId));
    const [watch] = await db()
      .insert(watches)
      .values({
        subjectId: base!.subjectId,
        frequencyHours: 24,
        baselineCaseId: caseId,
        nextRunAt: new Date(),
      })
      .returning({ id: watches.id });
    return { caseId, watchId: watch!.id };
  }

  it("AC-10: a simulated GST suspension raises a critical, simulated alert C to D with before/after", async () => {
    const { caseId, watchId } = await watchedBaseline();
    const outcome = await runWatch(watchId, { simulate: true });

    expect(outcome.alertId).not.toBeNull();
    const [alert] = await db().select().from(alerts).where(eq(alerts.id, outcome.alertId!));
    expect(alert).toMatchObject({
      severity: "critical",
      title: "GST registration suspended",
      isSimulated: true,
      previousCaseId: caseId,
      caseId: outcome.caseId,
    });
    expect(alert?.change).toMatchObject({
      gradeBefore: "C",
      gradeAfter: "D",
      scoreBefore: 66,
      scoreAfter: 38,
      hardStopAppeared: true,
    });
    const [moved] = await db().select().from(watches).where(eq(watches.id, watchId));
    expect(moved?.lastCaseId).toBe(outcome.caseId);
  });

  it("raises no alert when a monitoring pass finds the same state", async () => {
    const { watchId } = await watchedBaseline();
    const outcome = await runWatch(watchId);
    expect(outcome.alertId).toBeNull();
  });

  it("refuses to simulate a change for a company without a snapshot", async () => {
    const caseId = await createTestCase("demo", "29AAECK9012P1ZZ");
    await db().update(cases).set({ status: "completed" }).where(eq(cases.id, caseId));
    const [base] = await db().select().from(cases).where(eq(cases.id, caseId));
    const [watch] = await db()
      .insert(watches)
      .values({ subjectId: base!.subjectId, frequencyHours: 24, baselineCaseId: caseId })
      .returning({ id: watches.id });
    await expect(runWatch(watch!.id, { simulate: true })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
