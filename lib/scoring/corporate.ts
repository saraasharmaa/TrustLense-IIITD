import type { McaData } from "@/lib/adapters/schemas";
import type { SourceOutcomes } from "@/lib/adapters/types";
import type { Finding } from "@/lib/types";
import { monthsBetween } from "./dates";
import { makeFinding, readSource, type Source } from "./finding";

type McaPage = Extract<McaData, { status: "ok" }>;

const MIN_PAID_UP_CAPITAL = 100_000;
const REGULATORY_MIN_CONFIDENCE = 0.8;

function companyKey(page: McaPage): string {
  return page.cin ?? page.companyName ?? "mca";
}

// Unknown dates become -Infinity so they never exceed a threshold
function ageInMonths(date: string | null, now: Date): number {
  return date ? monthsBetween(date, now) : -Infinity;
}

function statusFinding(page: McaPage, source: Source<"mca">): Finding[] {
  if (!page.companyStatus || page.companyStatus.trim().toLowerCase() === "active") return [];
  return [
    makeFinding({
      ruleId: "MCA-01",
      category: "CORPORATE",
      severity: "critical",
      title: "Company not active",
      detail: `MCA-01: company status is ${page.companyStatus}. Rule: anything other than Active → −20, hard stop.`,
      penalty: 20,
      hardStop: true,
      fingerprint: `MCA-01:${companyKey(page)}`,
      evidence: [source.evidence(`Company status: ${page.companyStatus}`)],
    }),
  ];
}

function filingFinding(page: McaPage, source: Source<"mca">, now: Date): Finding[] {
  // A missing date is unknown, not overdue, so it is never penalised
  const balanceSheet = ageInMonths(page.lastBalanceSheetDate, now);
  const agm = ageInMonths(page.lastAgmDate, now);
  const badly = balanceSheet > 36 || agm > 36;
  const overdue = balanceSheet > 24 || agm > 18;
  if (!badly && !overdue) return [];

  const penalty = badly ? 12 : 8;
  return [
    makeFinding({
      ruleId: "MCA-02",
      category: "CORPORATE",
      severity: badly ? "high" : "medium",
      title: badly ? "Filings badly overdue" : "Filings overdue",
      detail: badly
        ? "MCA-02: balance sheet or AGM is more than 36 months old. Rule: → −12."
        : "MCA-02: balance sheet is more than 24 months old or AGM more than 18. Rule: → −8.",
      penalty,
      fingerprint: `MCA-02:${companyKey(page)}`,
      evidence: [
        source.evidence(
          `Last balance sheet: ${page.lastBalanceSheetDate ?? "unknown"}; last AGM: ${page.lastAgmDate ?? "unknown"}`,
        ),
      ],
    }),
  ];
}

function capitalFinding(page: McaPage, source: Source<"mca">): Finding[] {
  if (page.paidUpCapital === null || page.paidUpCapital >= MIN_PAID_UP_CAPITAL) return [];
  return [
    makeFinding({
      ruleId: "MCA-04",
      category: "CORPORATE",
      severity: "low",
      title: "Very low paid-up capital",
      detail: "MCA-04: paid-up capital is below ₹1,00,000. Rule: → −3.",
      penalty: 3,
      fingerprint: `MCA-04:${companyKey(page)}`,
      evidence: [
        source.evidence(`Paid-up capital: ₹${page.paidUpCapital.toLocaleString("en-IN")}`),
      ],
    }),
  ];
}

function disqualifiedFinding(name: string, key: string, evidence: Finding["evidence"]): Finding {
  return makeFinding({
    ruleId: "MCA-03",
    category: "CORPORATE",
    severity: "high",
    title: "Disqualified director",
    detail: `MCA-03: ${name} is flagged as a disqualified director. Rule: → −12, counted once however many directors.`,
    penalty: 12,
    fingerprint: `MCA-03:${key}`,
    evidence,
  });
}

function mcaDisqualified(page: McaPage, source: Source<"mca">): Map<string, Finding> {
  const flagged = new Map<string, Finding>();
  for (const director of page.directors) {
    if (!director.disqualified) continue;
    const key = director.din ?? director.name.toLowerCase();
    const dinNote = director.din ? ` (DIN ${director.din})` : "";
    flagged.set(
      key,
      disqualifiedFinding(director.name, key, [
        source.evidence(`${director.name}${dinNote} is flagged disqualified`),
      ]),
    );
  }
  return flagged;
}

// The MCA disqualified list and MCA's own director flags are one signal: a person already flagged
// by name is not added twice, and the group allocation counts the penalty once anyway.
function listedDisqualified(outcomes: SourceOutcomes, knownNames: Set<string>): Finding[] {
  const regulatory = readSource("regulatory", outcomes);
  if (regulatory?.data.status !== "ok") return [];
  const findings = new Map<string, Finding>();
  for (const match of regulatory.data.matches) {
    const name = match.matchedName.toLowerCase();
    const counts =
      match.list === "MCA_DISQUALIFIED_DIRECTORS" && match.confidence >= REGULATORY_MIN_CONFIDENCE;
    if (!counts || knownNames.has(name)) continue;
    findings.set(
      name,
      disqualifiedFinding(match.matchedName, name, [regulatory.evidence(match.summary, match.url)]),
    );
  }
  return [...findings.values()];
}

export function corporateFindings(outcomes: SourceOutcomes, now: Date): Finding[] {
  const source = readSource("mca", outcomes);
  const page = source?.data.status === "ok" ? source.data : null;
  if (!source || !page) return listedDisqualified(outcomes, new Set());

  const flagged = mcaDisqualified(page, source);
  const flaggedNames = new Set(
    page.directors.filter((d) => d.disqualified).map((d) => d.name.toLowerCase()),
  );
  return [
    ...statusFinding(page, source),
    ...filingFinding(page, source, now),
    ...capitalFinding(page, source),
    ...flagged.values(),
    ...listedDisqualified(outcomes, flaggedNames),
  ];
}
