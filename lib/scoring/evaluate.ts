import type { SourceOutcomes } from "@/lib/adapters/types";
import type { AdapterId, Finding } from "@/lib/types";
import { adverseFindings } from "./adverse";
import { corporateFindings } from "./corporate";
import { coverageFindings } from "./coverage";
import { legalFindings } from "./legal";
import { legitimacyFindings } from "./legitimacy";
import { allocatePenalties } from "./penalties";
import { statutoryFindings } from "./statutory";

export interface EvaluateContext {
  now: Date;
  requested: AdapterId[];
}

export function evaluate(outcomes: SourceOutcomes, ctx: EvaluateContext): Finding[] {
  return allocatePenalties([
    ...statutoryFindings(outcomes, ctx.now),
    ...corporateFindings(outcomes, ctx.now),
    ...legalFindings(outcomes),
    ...adverseFindings(outcomes, ctx.now),
    ...legitimacyFindings(outcomes),
    ...coverageFindings(outcomes, ctx.requested),
  ]);
}
