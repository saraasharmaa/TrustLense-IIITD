import { describe, expect, it } from "vitest";
import type { Finding, Narrative } from "@/lib/types";
import { narrativeProblems } from "./validate-narrative";

const REC = "Manual review required";

const finding = (
  id: string,
  detail = "Four of the last 12 GSTR-3B returns were not filed",
): Finding => ({
  id,
  ruleId: "GST-03",
  category: "STATUTORY",
  severity: "medium",
  title: "Repeated missed GSTR-3B",
  detail,
  penalty: 8,
  appliedPenalty: 8,
  hardStop: false,
  confidence: 1,
  fingerprint: id,
  evidence: [
    {
      sourceRunId: "00000000-0000-4000-8000-000000000000",
      adapter: "gst",
      url: "https://x.example",
      retrievedAt: "2026-10-24T00:00:00.000Z",
      excerpt: "Not Filed 2026-07",
      isReplay: true,
    },
  ],
});

const narrative = (over: Partial<Narrative> = {}): Narrative => ({
  headline: "Grade C",
  summary: "Several GSTR-3B returns were not filed.",
  keyRisks: [{ text: "Missed returns", findingIds: ["f1"] }],
  strengths: [],
  suggestedConditions: [],
  questionsForBorrower: [],
  source: "llm",
  ...over,
});

describe("narrativeProblems", () => {
  it("accepts a narrative that only uses the findings", () => {
    expect(narrativeProblems(narrative(), [finding("f1")], REC)).toEqual([]);
  });

  it("rejects cited finding ids that do not exist", () => {
    const n = narrative({ keyRisks: [{ text: "x", findingIds: ["nope"] }] });
    expect(narrativeProblems(n, [finding("f1")], REC)[0]).toMatch(/unknown finding ids: nope/);
  });

  it("rejects a year or rupee amount that is not in the findings", () => {
    const n = narrative({ summary: "Returns missed since 2019, exposure ₹5,00,000." });
    const problems = narrativeProblems(n, [finding("f1")], REC);
    expect(problems.join("|")).toMatch(/years.*2019/);
    expect(problems.join("|")).toMatch(/amounts.*₹5,00,000/);
  });

  it("allows a year that the findings state", () => {
    const n = narrative({ summary: "Last unfiled period was 2026-07." });
    expect(narrativeProblems(n, [finding("f1")], REC)).toEqual([]);
  });

  it("rejects summaries over 120 words", () => {
    const n = narrative({ summary: Array(121).fill("word").join(" ") });
    expect(narrativeProblems(n, [finding("f1")], REC).join()).toMatch(/121 words/);
  });

  it("rejects approval or rejection language but allows the rule-based recommendation", () => {
    const bad = narrative({ summary: "We recommend you approve this loan." });
    expect(narrativeProblems(bad, [finding("f1")], REC).join()).toMatch(/approval or rejection/);
    const ok = narrative({ headline: "Recommendation: Proceed with conditions" });
    expect(narrativeProblems(ok, [finding("f1")], "Proceed with conditions")).toEqual([]);
  });
});
