import { describe, expect, it } from "vitest";
import { createTestCase, hasDatabase } from "@/lib/testing/db";
import { emitEvent, listEventsAfter, subscribe, type CaseEvent } from "./events";

describe.skipIf(!hasDatabase)("case events", () => {
  it("assigns increasing seq even when events are emitted concurrently", async () => {
    const caseId = await createTestCase();
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => emitEvent(caseId, "source.progress", { n: i })),
    );
    const events = await listEventsAfter(caseId, 0);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(events.map((e) => (e.data as { n: number }).n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("replays only events after a given seq", async () => {
    const caseId = await createTestCase();
    await emitEvent(caseId, "case.started", {});
    await emitEvent(caseId, "source.started", {});
    await emitEvent(caseId, "report.ready", {});
    const events = await listEventsAfter(caseId, 2);
    expect(events.map((e) => e.type)).toEqual(["report.ready"]);
  });

  it("pushes new events to subscribers until they unsubscribe", async () => {
    const caseId = await createTestCase();
    const seen: CaseEvent[] = [];
    const unsubscribe = subscribe(caseId, (e) => seen.push(e));
    await emitEvent(caseId, "case.started", {});
    unsubscribe();
    await emitEvent(caseId, "report.ready", {});
    expect(seen.map((e) => e.type)).toEqual(["case.started"]);
  });
});
