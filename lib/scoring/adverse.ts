import type { NewsData, RegulatoryData } from "@/lib/adapters/schemas";
import type { SourceOutcomes } from "@/lib/adapters/types";
import type { Finding, Severity } from "@/lib/types";
import { monthsBetween } from "./dates";
import { makeFinding, readSource, type Source } from "./finding";

type Article = Extract<NewsData, { status: "ok" }>["articles"][number];
type RegulatoryMatch = Extract<RegulatoryData, { status: "ok" }>["matches"][number];

const NEWS_MIN_CONFIDENCE = 0.7;
const REGULATORY_MIN_CONFIDENCE = 0.8;
const NEWS_MAX_AGE_MONTHS = 24;

const NEWS_RULES: Partial<
  Record<Article["severity"], { ruleId: string; severity: Severity; penalty: number }>
> = {
  high: { ruleId: "NEWS-01", severity: "high", penalty: 12 },
  medium: { ruleId: "NEWS-02", severity: "medium", penalty: 6 },
};

function articleFinding(
  source: Source<"news">,
  a: Article,
  fields: { ruleId: string; severity: Severity; title: string; detail: string; penalty?: number },
): Finding {
  return makeFinding({
    ...fields,
    category: "ADVERSE",
    confidence: a.entityMatchConfidence,
    fingerprint: `NEWS:${a.url}`,
    evidence: [source.evidence(`${a.title}: ${a.snippet}`, a.url)],
  });
}

// An undated article cannot be shown to be recent, so it is never scored
function isRecent(a: Article, now: Date): boolean {
  return a.publishedDate !== null && monthsBetween(a.publishedDate, now) <= NEWS_MAX_AGE_MONTHS;
}

function newsFindingFor(source: Source<"news">, a: Article, now: Date): Finding | null {
  const rule = NEWS_RULES[a.severity];
  const confident = a.entityMatchConfidence >= NEWS_MIN_CONFIDENCE;

  if (rule && !confident) {
    return articleFinding(source, a, {
      ruleId: "NEWS-POSSIBLE",
      severity: "info",
      title: "Possible match — verify",
      detail: `This article may be about a different entity with a similar name (match confidence ${a.entityMatchConfidence}). It is not scored.`,
    });
  }
  if (rule && !isRecent(a, now)) {
    return articleFinding(source, a, {
      ruleId: "NEWS-STALE",
      severity: "info",
      title: "Older or undated adverse article — not scored",
      detail: `Articles older than ${NEWS_MAX_AGE_MONTHS} months, or without a date, are shown but not scored.`,
    });
  }
  if (rule) {
    return articleFinding(source, a, {
      ...rule,
      title: `${a.severity === "high" ? "High" : "Medium"}-severity adverse news`,
      detail: `${rule.ruleId}: ${a.severity}-severity article from ${a.source}. Rule: → −${rule.penalty}.`,
    });
  }
  if (a.category === "positive_growth" && confident) {
    return articleFinding(source, a, {
      ruleId: "NEWS-03",
      severity: "info",
      title: "Positive news",
      detail: "NEWS-03: positive growth coverage. Not scored.",
    });
  }
  return null;
}

function newsFindings(outcomes: SourceOutcomes, now: Date): Finding[] {
  const source = readSource("news", outcomes);
  if (!source || source.data.status !== "ok") return [];
  return source.data.articles
    .map((a) => newsFindingFor(source, a, now))
    .filter((f): f is Finding => f !== null);
}

function regulatoryFinding(source: Source<"regulatory">, m: RegulatoryMatch): Finding {
  const confident = m.confidence >= REGULATORY_MIN_CONFIDENCE;
  return makeFinding({
    ruleId: confident ? "REG-01" : "REG-POSSIBLE",
    category: "ADVERSE",
    severity: confident ? "high" : "info",
    title: confident ? "Regulatory match" : "Possible match — verify",
    detail: confident
      ? `REG-01: ${m.matchedName} matched on ${m.list}. Rule: → −10.`
      : `${m.matchedName} may match ${m.list} but confidence is ${m.confidence}. It is not scored.`,
    penalty: confident ? 10 : 0,
    confidence: m.confidence,
    fingerprint: `REG-01:${m.url}`,
    evidence: [source.evidence(m.summary, m.url)],
  });
}

// The MCA disqualified-director list feeds MCA-03 instead (corporate.ts)
function regulatoryFindings(outcomes: SourceOutcomes): Finding[] {
  const source = readSource("regulatory", outcomes);
  if (!source || source.data.status !== "ok") return [];
  return source.data.matches
    .filter((m) => m.list !== "MCA_DISQUALIFIED_DIRECTORS")
    .map((m) => regulatoryFinding(source, m));
}

export function adverseFindings(outcomes: SourceOutcomes, now: Date): Finding[] {
  return [...newsFindings(outcomes, now), ...regulatoryFindings(outcomes)];
}
