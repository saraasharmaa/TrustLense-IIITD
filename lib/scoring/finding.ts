import type { z } from "zod";
import { adapterSchemas } from "@/lib/adapters/schemas";
import type { SourceOutcomes } from "@/lib/adapters/types";
import type { AdapterId, Category, Evidence, Finding, Severity } from "@/lib/types";

const EXCERPT_MAX = 300;
const USABLE_STATUSES = ["succeeded", "not_found", "carried_forward"];

export function clip(text: string, max = EXCERPT_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export interface Source<A extends AdapterId> {
  data: z.output<(typeof adapterSchemas)[A]>;
  // Evidence points at the specific record (case, article) when it has a valid URL, else the source page
  evidence(excerpt: string, itemUrl?: string): Evidence;
}

// Without a source URL a finding could not carry evidence, so such an outcome yields no findings.
// Unparseable data is dropped the same way instead of being coerced.
export function readSource<A extends AdapterId>(
  adapter: A,
  outcomes: SourceOutcomes,
): Source<A> | null {
  const outcome = outcomes[adapter];
  if (!outcome?.evidenceUrl || !USABLE_STATUSES.includes(outcome.status)) return null;
  const parsed = adapterSchemas[adapter].safeParse(outcome.normalized);
  if (!parsed.success) return null;
  const sourceUrl = outcome.evidenceUrl;
  return {
    data: parsed.data as z.output<(typeof adapterSchemas)[A]>,
    evidence: (excerpt, itemUrl) => ({
      sourceRunId: outcome.sourceRunId,
      adapter,
      url: itemUrl && URL.canParse(itemUrl) ? itemUrl : sourceUrl,
      retrievedAt: outcome.retrievedAt,
      excerpt: clip(excerpt),
      isReplay: outcome.isReplay,
    }),
  };
}

// Fingerprints that are not tied to a record (a case, an article) use the company as their key
export function subjectKey(outcomes: SourceOutcomes): string {
  const gst = readSource("gst", outcomes)?.data;
  if (gst?.status === "ok") return gst.gstin;
  const mca = readSource("mca", outcomes)?.data;
  return (mca?.status === "ok" && mca.cin) || "subject";
}

export interface FindingSpec {
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  penalty?: number;
  hardStop?: boolean;
  confidence?: number;
  fingerprint: string;
  evidence: Evidence[];
}

// The orchestrator replaces the id with a UUID; two rules may share a fingerprint, so the id adds the rule
export function makeFinding(spec: FindingSpec): Finding {
  return {
    id: `${spec.ruleId}:${spec.fingerprint}`,
    ruleId: spec.ruleId,
    category: spec.category,
    severity: spec.severity,
    title: spec.title,
    detail: spec.detail,
    penalty: spec.penalty ?? 0,
    appliedPenalty: 0,
    hardStop: spec.hardStop ?? false,
    confidence: spec.confidence ?? 1,
    fingerprint: spec.fingerprint,
    evidence: spec.evidence,
  };
}
