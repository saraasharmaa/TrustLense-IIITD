import type { Finding, Narrative } from "@/lib/types";

const MAX_SUMMARY_WORDS = 120;
const YEAR = /\b(19|20)\d{2}\b/g;
const RUPEE_AMOUNT = /₹\s?[\d,]+(?:\.\d+)?(?:\s?(?:crore|lakh|cr|l))?/gi;
const DECISION_WORDS =
  /\b(approve|approved|approval|reject|rejected|decline|declined|deny|denied)\b/i;

function allText(n: Narrative): string {
  return [
    n.headline,
    n.summary,
    ...n.keyRisks.map((r) => r.text),
    ...n.strengths.map((s) => s.text),
    ...n.suggestedConditions,
    ...n.questionsForBorrower,
  ].join("\n");
}

const findingText = (findings: Finding[]) =>
  findings
    .flatMap((f) => [f.title, f.detail, ...f.evidence.map((e) => `${e.excerpt} ${e.retrievedAt}`)])
    .join("\n");

function unknownTokens(text: string, pattern: RegExp, known: string): string[] {
  return (text.match(pattern) ?? []).filter((token) => !known.includes(token));
}

// Returns the reasons a narrative must be rejected; empty means it is safe to show (FR-7.2, 7.3)
export function narrativeProblems(
  narrative: Narrative,
  findings: Finding[],
  recommendation: string,
): string[] {
  const problems: string[] = [];
  const ids = new Set(findings.map((f) => f.id));
  const cited = [...narrative.keyRisks, ...narrative.strengths].flatMap((c) => c.findingIds);

  const unknownIds = cited.filter((id) => !ids.has(id));
  if (unknownIds.length) problems.push(`cites unknown finding ids: ${unknownIds.join(", ")}`);

  const words = narrative.summary.trim().split(/\s+/).length;
  if (words > MAX_SUMMARY_WORDS)
    problems.push(`summary has ${words} words, limit is ${MAX_SUMMARY_WORDS}`);

  // The recommendation text itself may contain these words, so it is allowed through
  const text = allText(narrative).replace(recommendation, "");
  const known = `${findingText(findings)}\n${recommendation}`;
  const years = unknownTokens(text, YEAR, known);
  if (years.length) problems.push(`mentions years not in the findings: ${years.join(", ")}`);
  const amounts = unknownTokens(text, RUPEE_AMOUNT, known);
  if (amounts.length) problems.push(`mentions amounts not in the findings: ${amounts.join(", ")}`);
  if (DECISION_WORDS.test(text)) problems.push("states an approval or rejection decision");

  return problems;
}
