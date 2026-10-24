// TEMPORARY: stands in for B's lib/scoring until their branch is merged.
// It makes no scoring claims: no findings, no score. Delete this file when wiring the real code.
import type { SourceOutcomes } from "@/lib/adapters/types";
import type { AdapterId, Finding, ScoreResult } from "@/lib/types";

export const evaluate: (
  outcomes: SourceOutcomes,
  ctx: { now: Date; requested: AdapterId[] },
) => Finding[] = () => [];

export const score: (findings: Finding[], outcomes: SourceOutcomes) => ScoreResult | null = () =>
  null;
