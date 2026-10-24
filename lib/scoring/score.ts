import type { SourceOutcomes } from "@/lib/adapters/types";
import type { Finding, ScoreResult } from "@/lib/types";
import { gradeFor, recommendationFor } from "./grades";
import { allocatePenalties } from "./penalties";
import {
  CATEGORY_CAPS,
  PRIMARY_ADAPTER,
  RULES_VERSION,
  SCORED_CATEGORIES,
  type ScoredCategory,
} from "./rules";

const COVERED_STATUSES = ["succeeded", "not_found", "carried_forward"];
const PROVISIONAL_BELOW = 60;

// Coverage in whole percentage points so the 0.59 / 0.60 boundary has no float noise
function coveredPoints(outcomes: SourceOutcomes): number {
  return SCORED_CATEGORIES.filter((category) => {
    const outcome = outcomes[PRIMARY_ADAPTER[category]];
    return outcome !== undefined && COVERED_STATUSES.includes(outcome.status);
  }).reduce((sum, category) => sum + CATEGORY_CAPS[category], 0);
}

function appliedByCategory(findings: Finding[]): Record<ScoredCategory, number> {
  const applied = Object.fromEntries(SCORED_CATEGORIES.map((c) => [c, 0])) as Record<
    ScoredCategory,
    number
  >;
  for (const finding of allocatePenalties(findings)) {
    if (finding.category !== "COVERAGE") applied[finding.category] += finding.appliedPenalty;
  }
  return applied;
}

function hardStopTitles(findings: Finding[]): string[] {
  return [...new Set(findings.filter((f) => f.hardStop).map((f) => f.title))];
}

export function score(findings: Finding[], outcomes: SourceOutcomes): ScoreResult {
  const applied = appliedByCategory(findings);
  const total = SCORED_CATEGORIES.reduce((sum, category) => sum + applied[category], 0);
  const value = Math.max(0, 100 - total);
  const hardStops = hardStopTitles(findings);
  const covered = coveredPoints(outcomes);
  const isProvisional = covered < PROVISIONAL_BELOW;
  const grade = gradeFor(value, hardStops);

  return {
    score: value,
    grade,
    recommendation: recommendationFor(grade, hardStops, isProvisional),
    hardStops,
    coverage: covered / 100,
    isProvisional,
    categoryBreakdown: SCORED_CATEGORIES.map((category) => ({
      category,
      cap: CATEGORY_CAPS[category],
      applied: applied[category],
    })),
    rulesVersion: RULES_VERSION,
  };
}
