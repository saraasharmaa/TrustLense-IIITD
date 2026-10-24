import { describe, expect, it } from "vitest";
import type { AdapterId, SourceStatus } from "@/lib/types";
import { score } from "./score";
import { outcome, outcomesOf, testFinding } from "./test-utils";

function withStatuses(statuses: Partial<Record<AdapterId, SourceStatus>>) {
  return outcomesOf(
    Object.fromEntries(
      Object.entries(statuses).map(([adapter, status]) => [adapter, outcome({}, { status })]),
    ),
  );
}

const allSucceeded = withStatuses({
  gst: "succeeded",
  mca: "succeeded",
  legal: "succeeded",
  news: "succeeded",
  udyam: "succeeded",
});

describe("score", () => {
  it("starts at 100 with no findings and a full-coverage A", () => {
    expect(score([], allSucceeded)).toMatchObject({
      score: 100,
      grade: "A",
      recommendation: "Proceed with standard checks",
      hardStops: [],
      coverage: 1,
      isProvisional: false,
      rulesVersion: "1.0.0",
    });
  });

  it("subtracts applied penalties and reports each category against its cap", () => {
    const result = score(
      [
        testFinding({ ruleId: "GST-03", penalty: 8, fingerprint: "a" }),
        testFinding({ ruleId: "LEG-04", category: "LEGAL", penalty: 3, fingerprint: "b" }),
      ],
      allSucceeded,
    );
    expect(result.score).toBe(89);
    expect(result.categoryBreakdown).toEqual([
      { category: "STATUTORY", cap: 30, applied: 8 },
      { category: "CORPORATE", cap: 20, applied: 0 },
      { category: "LEGAL", cap: 25, applied: 3 },
      { category: "ADVERSE", cap: 15, applied: 0 },
      { category: "LEGITIMACY", cap: 10, applied: 0 },
    ]);
  });

  it("caps a category at 30 when raw penalties are 49", () => {
    const result = score(
      [
        testFinding({ ruleId: "GST-01", penalty: 30, hardStop: true, fingerprint: "a" }),
        testFinding({ ruleId: "GST-04", penalty: 4, fingerprint: "b" }),
        testFinding({ ruleId: "GST-03", penalty: 15, fingerprint: "c" }),
      ],
      allSucceeded,
    );
    expect(result.categoryBreakdown[0]?.applied).toBe(30);
    expect(result.score).toBe(70);
  });

  it("forces D at a high score on a hard stop and lists each title once", () => {
    const stops = [
      testFinding({
        ruleId: "LEG-01",
        category: "LEGAL",
        penalty: 25,
        hardStop: true,
        title: "Insolvency proceedings",
        fingerprint: "a",
      }),
      testFinding({
        ruleId: "LEG-01",
        category: "LEGAL",
        penalty: 25,
        hardStop: true,
        title: "Insolvency proceedings",
        fingerprint: "b",
      }),
    ];
    const result = score(stops, allSucceeded);
    expect(result.grade).toBe("D");
    expect(result.hardStops).toEqual(["Insolvency proceedings"]);
    expect(result.recommendation).toBe("Escalate – high risk (hard stop: Insolvency proceedings)");
  });

  it("does not subtract coverage findings", () => {
    const result = score(
      [
        testFinding({
          ruleId: "COVERAGE-GST",
          category: "COVERAGE",
          severity: "info",
          fingerprint: "c",
        }),
      ],
      allSucceeded,
    );
    expect(result.score).toBe(100);
  });
});

describe("coverage", () => {
  it.each(["succeeded", "not_found", "carried_forward"] as const)(
    "%s counts as covered",
    (status) => {
      expect(score([], withStatuses({ gst: status })).coverage).toBe(0.3);
    },
  );

  it.each(["failed", "timeout", "captcha_blocked", "skipped", "pending", "running"] as const)(
    "%s does not count",
    (status) => {
      expect(score([], withStatuses({ gst: status })).coverage).toBe(0);
    },
  );

  it("counts only primary adapters and treats an unrequested adapter as uncovered", () => {
    const result = score([], withStatuses({ gst: "succeeded", regulatory: "succeeded" }));
    expect(result.coverage).toBe(0.3);
  });

  it("is provisional at 0.55 and not at 0.60", () => {
    const at55 = score([], withStatuses({ gst: "succeeded", legal: "succeeded" }));
    expect(at55).toMatchObject({ coverage: 0.55, isProvisional: true });
    const at60 = score(
      [],
      withStatuses({ gst: "succeeded", mca: "succeeded", udyam: "succeeded" }),
    );
    expect(at60).toMatchObject({ coverage: 0.6, isProvisional: false });
  });

  it("downgrades an A/B recommendation when provisional", () => {
    const result = score([], withStatuses({ gst: "succeeded", legal: "succeeded" }));
    expect(result.recommendation).toBe("Manual review required (limited coverage)");
  });
});
