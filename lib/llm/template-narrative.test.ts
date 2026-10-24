import { describe, expect, it } from "vitest";
import { Narrative, type Finding, type ScoreResult } from "@/lib/types";
import { templateNarrative } from "./template-narrative";

function finding(id: string, severity: Finding["severity"], ruleId = "GST-03"): Finding {
  return {
    id,
    ruleId,
    category: "STATUTORY",
    severity,
    title: `Title ${id}`,
    detail: "d",
    penalty: 0,
    appliedPenalty: 0,
    hardStop: false,
    confidence: 1,
    fingerprint: id,
    evidence: [],
  };
}

const result: ScoreResult = {
  score: 66,
  grade: "C",
  recommendation: "Manual review required",
  hardStops: [],
  coverage: 1,
  isProvisional: false,
  categoryBreakdown: [],
  rulesVersion: "1.0.0",
};

describe("templateNarrative", () => {
  it("echoes the rule-derived recommendation and cites finding ids by severity", () => {
    const n = templateNarrative([finding("a", "low"), finding("b", "high")], result);
    expect(Narrative.safeParse(n).success).toBe(true);
    expect(n.summary).toContain("Manual review required");
    expect(n.keyRisks.map((r) => r.findingIds[0])).toEqual(["b", "a"]);
    expect(n.source).toBe("template");
  });

  it("flags limited coverage as provisional", () => {
    const n = templateNarrative([], { ...result, coverage: 0.4, isProvisional: true });
    expect(n.summary).toMatch(/provisional/);
  });

  it("gives no recommendation when there is no score", () => {
    const n = templateNarrative([finding("a", "high")], null);
    expect(n.summary).toMatch(/no recommendation/);
    expect(n.headline).not.toMatch(/Grade/);
  });

  it("keeps the summary under the 120 word limit", () => {
    const n = templateNarrative(
      Array.from({ length: 30 }, (_, i) => finding(`f${i}`, "high")),
      result,
    );
    expect(n.summary.split(/\s+/).length).toBeLessThanOrEqual(120);
  });
});
