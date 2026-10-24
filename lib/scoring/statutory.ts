import type { SourceOutcomes } from "@/lib/adapters/types";
import type { GstData } from "@/lib/adapters/schemas";
import type { Finding, Severity } from "@/lib/types";
import { monthsBetween } from "./dates";
import { makeFinding, readSource, type Source } from "./finding";

type GstPage = Extract<GstData, { status: "ok" }>;
type Return = GstPage["returns"][number];

const RETURNS_WINDOW = 12;

function recentThreeB(page: GstPage): Return[] {
  return page.returns
    .filter((r) => r.form === "GSTR-3B")
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-RETURNS_WINDOW);
}

// GSTR-3B is due on the 20th of the month after the period
function isLate(r: Return): boolean {
  if (r.status !== "Filed" || !r.filedDate) return false;
  const [year, month] = r.period.split("-").map(Number) as [number, number];
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  return r.filedDate > `${dueYear}-${String(dueMonth).padStart(2, "0")}-20`;
}

interface Tier {
  penalty: number;
  severity: Severity;
  title: string;
  rule: string;
}

function filingTier(missed: number, late: number): Tier | null {
  if (missed >= 6) {
    return {
      penalty: 15,
      severity: "high",
      title: "Frequent missed GSTR-3B",
      rule: "6 or more missed",
    };
  }
  if (missed >= 3) {
    return {
      penalty: 8,
      severity: "medium",
      title: "Repeated missed GSTR-3B",
      rule: "3 or more missed",
    };
  }
  if (late >= 4) {
    return { penalty: 4, severity: "low", title: "Repeated late GSTR-3B", rule: "4 or more late" };
  }
  return null;
}

function statusFinding(page: GstPage, source: Source<"gst">): Finding[] {
  const status = page.registrationStatus?.toLowerCase();
  if (status !== "cancelled" && status !== "suspended") return [];
  return [
    makeFinding({
      ruleId: "GST-01",
      category: "STATUTORY",
      severity: "critical",
      title: `GST registration ${status}`,
      detail: `GST-01: registration status is ${page.registrationStatus}. Rule: cancelled or suspended → −30, hard stop.`,
      penalty: 30,
      hardStop: true,
      fingerprint: `GST-01:${page.gstin}`,
      evidence: [source.evidence(`Registration status: ${page.registrationStatus}`)],
    }),
  ];
}

function filingFindings(page: GstPage, source: Source<"gst">): Finding[] {
  const returns = recentThreeB(page);
  if (returns.length === 0) {
    return [
      makeFinding({
        ruleId: "COVERAGE-GST-RETURNS",
        category: "COVERAGE",
        severity: "info",
        title: "Could not verify GST return filing history",
        detail: "Could not verify GST filing: the source listed no GSTR-3B returns.",
        fingerprint: `COVERAGE-GST-RETURNS:${page.gstin}`,
        evidence: [source.evidence("No GSTR-3B returns were listed")],
      }),
    ];
  }

  const missed = returns.filter((r) => r.status === "Not Filed");
  const late = returns.filter(isLate);
  const fingerprint = `GST-FILING:${page.gstin}`;
  const periods = (rs: Return[]) => rs.map((r) => r.period).join(", ");
  const findings: Finding[] = [];

  if (returns.length >= 3 && returns.slice(-3).every((r) => r.status === "Not Filed")) {
    findings.push(
      makeFinding({
        ruleId: "GST-02",
        category: "STATUTORY",
        severity: "high",
        title: "No GSTR-3B in last 3 periods",
        detail: "GST-02: the 3 most recent GSTR-3B periods are all not filed. Rule: → −15.",
        penalty: 15,
        fingerprint,
        evidence: [source.evidence(`Not filed: ${periods(returns.slice(-3))}`)],
      }),
    );
  }

  const tier = filingTier(missed.length, late.length);
  if (tier) {
    const count = missed.length >= 3 ? missed : late;
    const kind = missed.length >= 3 ? "not filed" : "filed late";
    findings.push(
      makeFinding({
        ruleId: "GST-03",
        category: "STATUTORY",
        severity: tier.severity,
        title: tier.title,
        detail: `GST-03: ${count.length} of last ${returns.length} GSTR-3B returns ${kind}. Rule: ${tier.rule} → −${tier.penalty}.`,
        penalty: tier.penalty,
        fingerprint,
        evidence: [source.evidence(`${kind}: ${periods(count)}`)],
      }),
    );
  }
  return findings;
}

function ageFinding(page: GstPage, source: Source<"gst">, now: Date): Finding[] {
  if (!page.registrationDate || monthsBetween(page.registrationDate, now) >= 12) return [];
  return [
    makeFinding({
      ruleId: "GST-04",
      category: "STATUTORY",
      severity: "low",
      title: "Registered under 12 months ago",
      detail: "GST-04: registered less than 12 months before the check. Rule: → −4.",
      penalty: 4,
      fingerprint: `GST-04:${page.gstin}`,
      evidence: [source.evidence(`Registration date: ${page.registrationDate}`)],
    }),
  ];
}

export function statutoryFindings(outcomes: SourceOutcomes, now: Date): Finding[] {
  const source = readSource("gst", outcomes);
  if (!source || source.data.status !== "ok") return [];
  const page = source.data;
  return [
    ...statusFinding(page, source),
    ...filingFindings(page, source),
    ...ageFinding(page, source, now),
  ];
}
