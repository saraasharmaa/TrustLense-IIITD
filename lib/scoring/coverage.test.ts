import { describe, expect, it } from "vitest";
import type { AdapterId } from "@/lib/types";
import { coverageFindings } from "./coverage";
import { outcome, outcomesOf } from "./test-utils";

const ALL: AdapterId[] = ["gst", "mca", "legal", "news", "udyam", "regulatory"];

function ruleIds(findings: { ruleId: string }[]) {
  return findings.map((f) => f.ruleId);
}

describe("coverageFindings", () => {
  it.each([
    ["failed", "the source could not be read"],
    ["timeout", "the source timed out"],
    ["captcha_blocked", "the source asked for a CAPTCHA, which TrustLens does not bypass"],
    ["skipped", "the check was skipped"],
  ] as const)("reports a %s source", (status, reason) => {
    const o = outcome(undefined, { status });
    const [finding] = coverageFindings(outcomesOf({ gst: o }), ALL);
    expect(finding).toMatchObject({
      ruleId: "COVERAGE-GST",
      category: "COVERAGE",
      severity: "info",
      penalty: 0,
      hardStop: false,
      title: "Could not verify GST compliance",
      detail: `Could not verify GST compliance: ${reason}.`,
    });
    expect(finding?.evidence).toEqual([
      expect.objectContaining({ sourceRunId: o.sourceRunId, adapter: "gst", url: o.evidenceUrl }),
    ]);
  });

  it.each(["succeeded", "not_found", "carried_forward"] as const)("is silent for %s", (status) => {
    const findings = coverageFindings(outcomesOf({ gst: outcome({}, { status }) }), ["gst"]);
    expect(ruleIds(findings)).not.toContain("COVERAGE-GST");
  });

  it("reports sources that were not requested, with no evidence to point at", () => {
    const findings = coverageFindings(outcomesOf({ gst: outcome({}) }), ["gst"]);
    expect(ruleIds(findings)).toEqual([
      "COVERAGE-MCA",
      "COVERAGE-LEGAL",
      "COVERAGE-NEWS",
      "COVERAGE-UDYAM",
      "COVERAGE-REGULATORY",
    ]);
    expect(findings[0]).toMatchObject({
      detail: "Could not verify company standing: this source was not requested.",
      evidence: [],
    });
  });

  it("reports a requested source with no recorded result", () => {
    const [finding] = coverageFindings(outcomesOf({}), ALL);
    expect(finding?.detail).toBe("Could not verify GST compliance: no result was recorded.");
  });

  it("keeps the finding without evidence when the failed run has no URL", () => {
    const o = outcome(undefined, { status: "failed", evidenceUrl: undefined });
    expect(coverageFindings(outcomesOf({ gst: o }), ALL)[0]?.evidence).toEqual([]);
  });
});
