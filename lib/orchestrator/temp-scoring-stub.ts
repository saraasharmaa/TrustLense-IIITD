// TEMPORARY: stands in for B's lib/scoring and lib/identifiers until their branch is merged.
// It makes no scoring claims: no findings, no score. Delete this file when wiring the real code.
import type { SourceOutcomes } from "@/lib/adapters/types";
import { AppError } from "@/lib/errors";
import type { AdapterId, Finding, ScoreResult } from "@/lib/types";

const GSTIN_FORMAT = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const evaluate: (
  outcomes: SourceOutcomes,
  ctx: { now: Date; requested: AdapterId[] },
) => Finding[] = () => [];

export const score: (findings: Finding[], outcomes: SourceOutcomes) => ScoreResult | null = () =>
  null;

// Format only: no state table or checksum, so a typo can still pass
export function validateGstin(input: string): { gstin: string; pan: string; stateCode: string } {
  const gstin = input.trim().toUpperCase();
  if (!GSTIN_FORMAT.test(gstin)) {
    throw new AppError("invalid_identifier", "GSTIN format is invalid", { check: "format" });
  }
  return { gstin, pan: gstin.slice(2, 12), stateCode: gstin.slice(0, 2) };
}
