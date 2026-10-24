import type { LegalData } from "@/lib/adapters/schemas";
import type { SourceOutcomes } from "@/lib/adapters/types";
import type { Finding } from "@/lib/types";
import { makeFinding, readSource, type Source } from "./finding";

type LegalPage = Extract<LegalData, { status: "ok" }>;
type LegalCase = LegalPage["cases"][number];
type Notice = LegalPage["insolvencyNotices"][number];

const MIN_MATCH_CONFIDENCE = 0.7;
const INSOLVENCY_TYPE = /CIRP|insolvency|liquidation|winding/i;
const RECOVERY_TYPE = /138|cheque|recovery|DRT|SARFAESI/i;
const MULTIPLE_CASES = 3;
const MAX_EVIDENCE = 5;

// Live normalisers set matchConfidence from state/city/director overlap; fixtures omit it
function confidenceOf(item: { matchConfidence?: number }): number {
  return item.matchConfidence ?? 1;
}

function caseEvidence(source: Source<"legal">, c: LegalCase) {
  return source.evidence(`${c.caseNumber} (${c.forum}): ${c.summary}`, c.url);
}

function possibleMatch(
  source: Source<"legal">,
  label: string,
  key: string,
  summary: string,
  url: string,
  confidence: number,
): Finding {
  return makeFinding({
    ruleId: "LEG-POSSIBLE",
    category: "LEGAL",
    severity: "info",
    title: "Possible match — verify",
    detail: `${label} may belong to a different entity with a similar name (match confidence ${confidence}). It is not scored.`,
    confidence,
    fingerprint: `LEG-POSSIBLE:${key}`,
    evidence: [source.evidence(summary, url)],
  });
}

function insolvencyFindings(source: Source<"legal">, notices: Notice[]): Finding[] {
  return notices
    .filter((n) => INSOLVENCY_TYPE.test(n.noticeType) && confidenceOf(n) >= MIN_MATCH_CONFIDENCE)
    .map((n) =>
      makeFinding({
        ruleId: "LEG-01",
        category: "LEGAL",
        severity: "critical",
        title: "Insolvency proceedings",
        detail: `LEG-01: ${n.noticeType} notice from ${n.source}. Rule: insolvency, liquidation or winding up → −25, hard stop.`,
        penalty: 25,
        hardStop: true,
        confidence: confidenceOf(n),
        fingerprint: `LEG-01:${n.url}`,
        evidence: [source.evidence(n.summary, n.url)],
      }),
    );
}

function caseFinding(
  source: Source<"legal">,
  c: LegalCase,
  fields: Pick<Finding, "ruleId" | "severity" | "title" | "penalty"> & { rule: string },
): Finding {
  return makeFinding({
    ruleId: fields.ruleId,
    category: "LEGAL",
    severity: fields.severity,
    title: fields.title,
    detail: `${fields.ruleId}: pending case ${c.caseNumber} (${c.caseType}). Rule: ${fields.rule} → −${fields.penalty}.`,
    penalty: fields.penalty,
    confidence: confidenceOf(c),
    fingerprint: `${fields.ruleId}:${c.caseNumber}`,
    evidence: [caseEvidence(source, c)],
  });
}

function caseFindings(source: Source<"legal">, page: LegalPage): Finding[] {
  const pending = page.cases.filter(
    (c) => c.status === "Pending" && confidenceOf(c) >= MIN_MATCH_CONFIDENCE,
  );
  const respondent = pending.filter((c) => c.role === "Respondent");
  const findings: Finding[] = [];

  for (const c of respondent.filter((c) => RECOVERY_TYPE.test(c.caseType))) {
    findings.push(
      caseFinding(source, c, {
        ruleId: "LEG-02",
        severity: "high",
        title: "Pending recovery/cheque case",
        penalty: 12,
        rule: "pending cheque or recovery case as respondent",
      }),
    );
  }

  if (respondent.length >= MULTIPLE_CASES) {
    findings.push(
      makeFinding({
        ruleId: "LEG-03",
        category: "LEGAL",
        severity: "medium",
        title: "Multiple pending cases",
        detail: `LEG-03: ${respondent.length} pending cases as respondent. Rule: 3 or more → −8.`,
        penalty: 8,
        fingerprint: `LEG-03:${page.searchedNames[0] ?? "legal"}`,
        evidence: respondent.slice(0, MAX_EVIDENCE).map((c) => caseEvidence(source, c)),
      }),
    );
  }

  for (const c of pending) {
    findings.push(
      caseFinding(source, c, {
        ruleId: "LEG-04",
        severity: "low",
        title: "Pending case",
        penalty: 3,
        rule: "any pending case",
      }),
    );
  }
  return findings;
}

function possibleMatches(source: Source<"legal">, page: LegalPage): Finding[] {
  return [
    ...page.cases
      .filter((c) => confidenceOf(c) < MIN_MATCH_CONFIDENCE)
      .map((c) =>
        possibleMatch(
          source,
          `Case ${c.caseNumber}`,
          c.caseNumber,
          c.summary,
          c.url,
          confidenceOf(c),
        ),
      ),
    ...page.insolvencyNotices
      .filter((n) => confidenceOf(n) < MIN_MATCH_CONFIDENCE)
      .map((n) =>
        possibleMatch(source, `Notice from ${n.source}`, n.url, n.summary, n.url, confidenceOf(n)),
      ),
  ];
}

export function legalFindings(outcomes: SourceOutcomes): Finding[] {
  const source = readSource("legal", outcomes);
  if (!source || source.data.status !== "ok") return [];
  return [
    ...insolvencyFindings(source, source.data.insolvencyNotices),
    ...caseFindings(source, source.data),
    ...possibleMatches(source, source.data),
  ];
}
