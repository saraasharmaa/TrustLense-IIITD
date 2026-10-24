import type { Finding, Narrative, ScoreResult } from "@/lib/types";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;

const topRisks = (findings: Finding[]) =>
  findings
    .filter((f) => f.severity !== "info" && f.category !== "COVERAGE")
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, 5);

// Deterministic fallback used when the LLM is unavailable or its output fails validation
export function templateNarrative(findings: Finding[], result: ScoreResult | null): Narrative {
  const risks = topRisks(findings);
  const positives = findings.filter((f) => f.severity === "info" && f.ruleId.startsWith("NEWS-03"));

  if (!result) {
    return {
      headline: "Risk score not available for this check",
      summary: `${findings.length} findings were recorded. No score was computed, so no recommendation is given.`,
      keyRisks: risks.map((f) => ({ text: f.title, findingIds: [f.id] })),
      strengths: [],
      suggestedConditions: [],
      questionsForBorrower: [],
      source: "template",
    };
  }

  const coverage = Math.round(result.coverage * 100);
  const limited = result.isProvisional
    ? " Coverage is limited, so this result is provisional."
    : "";
  return {
    headline: `Grade ${result.grade}, score ${result.score}: ${result.recommendation}`,
    summary:
      `Recommendation: ${result.recommendation}. ${findings.length} findings were recorded ` +
      `with ${coverage}% of risk areas verified.${limited}`,
    keyRisks: risks.map((f) => ({ text: f.title, findingIds: [f.id] })),
    strengths: positives.slice(0, 3).map((f) => ({ text: f.title, findingIds: [f.id] })),
    suggestedConditions: result.hardStops.length
      ? ["Resolve the hard-stop findings and verify them at the source before proceeding"]
      : [],
    questionsForBorrower: risks.slice(0, 4).map((f) => `Can you explain: ${f.title}?`),
    source: "template",
  };
}
