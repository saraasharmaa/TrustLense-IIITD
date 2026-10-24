import type { SourceOutcome, SourceOutcomes } from "@/lib/adapters/types";
import type { AdapterId, Evidence, Finding } from "@/lib/types";
import { makeFinding, subjectKey } from "./finding";
import { CATEGORY_LABELS, type ScoredCategory } from "./rules";

const ADAPTER_CATEGORY: Record<AdapterId, ScoredCategory> = {
  gst: "STATUTORY",
  mca: "CORPORATE",
  legal: "LEGAL",
  news: "ADVERSE",
  udyam: "LEGITIMACY",
  regulatory: "ADVERSE",
};

const ADAPTERS = Object.keys(ADAPTER_CATEGORY) as AdapterId[];

const UNVERIFIED_REASONS: Partial<Record<string, string>> = {
  failed: "the source could not be read",
  timeout: "the source timed out",
  captcha_blocked: "the source asked for a CAPTCHA, which TrustLens does not bypass",
  skipped: "the check was skipped",
};

function reasonFor(
  adapter: AdapterId,
  requested: AdapterId[],
  outcome?: SourceOutcome,
): string | null {
  if (!requested.includes(adapter)) return "this source was not requested";
  if (!outcome) return "no result was recorded";
  return UNVERIFIED_REASONS[outcome.status] ?? null;
}

// The source run itself is the evidence, so it needs a run id and a URL to point at
function runEvidence(
  adapter: AdapterId,
  outcome: SourceOutcome | undefined,
  reason: string,
): Evidence[] {
  if (!outcome?.evidenceUrl) return [];
  return [
    {
      sourceRunId: outcome.sourceRunId,
      adapter,
      url: outcome.evidenceUrl,
      retrievedAt: outcome.retrievedAt,
      excerpt: `Source status: ${outcome.status} (${reason})`,
      isReplay: outcome.isReplay,
    },
  ];
}

export function coverageFindings(outcomes: SourceOutcomes, requested: AdapterId[]): Finding[] {
  const key = subjectKey(outcomes);
  return ADAPTERS.flatMap((adapter) => {
    const outcome = outcomes[adapter];
    const reason = reasonFor(adapter, requested, outcome);
    if (!reason) return [];
    const label = CATEGORY_LABELS[ADAPTER_CATEGORY[adapter]];
    return [
      makeFinding({
        ruleId: `COVERAGE-${adapter.toUpperCase()}`,
        category: "COVERAGE",
        severity: "info",
        title: `Could not verify ${label}`,
        detail: `Could not verify ${label}: ${reason}.`,
        fingerprint: `COVERAGE-${adapter.toUpperCase()}:${key}`,
        evidence: runEvidence(adapter, outcome, reason),
      }),
    ];
  });
}
