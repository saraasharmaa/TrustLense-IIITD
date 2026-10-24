import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as registry from "@/lib/adapters/registry";
import { db } from "@/lib/db/client";
import { cases, sourceRuns } from "@/lib/db/schema";
import { createTestCase, hasDatabase } from "@/lib/testing/db";
import { listEventsAfter } from "./events";
import { runCase } from "./runCase";

const options = { replay: { delayMs: [0, 0] as [number, number] }, backoffMs: 1 };
const SUNRISE = "33AABCS7345M1Z3";

describe.skipIf(!hasDatabase)("runCase", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs replay adapters to a completed case and ends with report.ready", async () => {
    const caseId = await createTestCase("demo", SUNRISE);
    await db()
      .update(cases)
      .set({ requestedSources: ["gst", "news"] })
      .where(eq(cases.id, caseId));
    await runCase(caseId, options);

    const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
    expect(row?.status).toBe("completed");
    const types = (await listEventsAfter(caseId, 0)).map((e) => e.type);
    expect(types[0]).toBe("case.started");
    expect(types.at(-1)).toBe("report.ready");
    const runs = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
    expect(runs.every((r) => r.isReplay && r.status === "succeeded")).toBe(true);
  });

  it("AC-3: one adapter throwing leaves the case partial and the others finished", async () => {
    const real = registry.getAdapter;
    vi.spyOn(registry, "getAdapter").mockImplementation((id, mode, replay) =>
      id === "gst"
        ? {
            ...real(id, mode, replay),
            run: async () => Promise.reject(new Error("forced failure")),
          }
        : real(id, mode, replay),
    );
    const caseId = await createTestCase("demo", SUNRISE);
    await db()
      .update(cases)
      .set({ requestedSources: ["gst", "news"] })
      .where(eq(cases.id, caseId));
    await runCase(caseId, options);

    const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
    expect(row?.status).toBe("partial");
    const runs = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
    expect(runs.find((r) => r.adapter === "gst")).toMatchObject({ status: "failed", attempt: 2 });
    expect(runs.find((r) => r.adapter === "news")?.status).toBe("succeeded");
  });

  it("reruns only the failed source in place and keeps the other run", async () => {
    const real = registry.getAdapter;
    const spy = vi.spyOn(registry, "getAdapter").mockImplementation((id, mode, replay) =>
      id === "gst"
        ? {
            ...real(id, mode, replay),
            run: async () => Promise.reject(new Error("forced failure")),
          }
        : real(id, mode, replay),
    );
    const caseId = await createTestCase("demo", SUNRISE);
    await db()
      .update(cases)
      .set({ requestedSources: ["gst", "news"] })
      .where(eq(cases.id, caseId));
    await runCase(caseId, options);
    const before = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
    const newsBefore = before.find((r) => r.adapter === "news");

    spy.mockRestore();
    await runCase(caseId, { ...options, only: ["gst"] });

    const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
    expect(row?.status).toBe("completed");
    const after = await db().select().from(sourceRuns).where(eq(sourceRuns.caseId, caseId));
    expect(after).toHaveLength(2);
    expect(after.find((r) => r.adapter === "news")?.id).toBe(newsBefore?.id);
    expect(after.find((r) => r.adapter === "gst")?.status).toBe("succeeded");
  });

  it("marks the case failed when no source returns data", async () => {
    const caseId = await createTestCase("live", `L${Date.now()}`);
    await runCase(caseId, options);
    const [row] = await db().select().from(cases).where(eq(cases.id, caseId));
    expect(row?.status).toBe("failed");
    const events = await listEventsAfter(caseId, 0);
    expect(events.at(-1)?.type).toBe("case.failed");
  });
});
