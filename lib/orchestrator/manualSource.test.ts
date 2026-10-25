import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { cases, findings, sourceRuns } from "@/lib/db/schema";
import { createTestCase, hasDatabase } from "@/lib/testing/db";
import { enterGstManually } from "./manualSource";

const SUNRISE = "33AABCS7345M1Z3";

async function blockedGstCase(mode: "live" | "demo" = "live") {
  const caseId = await createTestCase(mode, SUNRISE);
  await db()
    .update(cases)
    .set({ status: "failed", requestedSources: ["gst"] })
    .where(eq(cases.id, caseId));
  await db()
    .insert(sourceRuns)
    .values({
      caseId,
      adapter: "gst",
      status: "captcha_blocked",
      error: "Task blocked by CAPTCHA",
    });
  return caseId;
}

describe.skipIf(!hasDatabase)("enterGstManually", { timeout: 20_000 }, () => {
  it("replaces the blocked run with a labelled analyst entry and scores the case", async () => {
    const caseId = await blockedGstCase();
    await enterGstManually(caseId, {
      registrationStatus: "Suspended",
      registrationDate: "2018-04-01",
    });

    const runs = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      adapter: "gst",
      status: "succeeded",
      isManual: true,
      isReplay: false,
    });
    const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
    expect(row?.status).toBe("completed");
    expect(row?.grade).toBe("D");
    const found = await db().select().from(findings).where(eq(findings.caseId, caseId));
    const gst01 = found.find((f) => f.ruleId === "GST-01");
    expect(gst01?.hardStop).toBe(true);
    expect(gst01?.evidence[0]?.url).toContain("services.gst.gov.in");
  });

  it("refuses replay cases, where there is nothing to unblock", async () => {
    const caseId = await blockedGstCase("demo");
    await expect(enterGstManually(caseId, { registrationStatus: "Active" })).rejects.toMatchObject({
      code: "conflict",
    });
  });
});
