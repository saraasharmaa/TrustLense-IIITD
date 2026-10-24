import type { SourceOutcome, SourceOutcomes } from "@/lib/adapters/types";
import type { AdapterId, Finding, SourceStatus } from "@/lib/types";
import { makeFinding, type FindingSpec } from "./finding";

export const NOW = new Date("2026-10-24");

let counter = 0;

export function outcome(
  normalized: unknown,
  overrides: Partial<SourceOutcome> & { status?: SourceStatus } = {},
): SourceOutcome {
  counter += 1;
  return {
    sourceRunId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    status: "succeeded",
    normalized,
    evidenceUrl: "https://example.invalid/replay/test",
    retrievedAt: "2026-10-24T08:00:00.000Z",
    isReplay: true,
    ...overrides,
  };
}

export function outcomesOf(entries: Partial<Record<AdapterId, SourceOutcome>>): SourceOutcomes {
  return entries;
}

export function testFinding(spec: Partial<FindingSpec> & Pick<FindingSpec, "ruleId">): Finding {
  return makeFinding({
    category: "STATUTORY",
    severity: "medium",
    title: spec.ruleId,
    detail: "",
    penalty: 0,
    fingerprint: `${spec.ruleId}:test`,
    evidence: [],
    ...spec,
  });
}
