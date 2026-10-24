import type { AdapterId, SourceStatus } from "@/lib/types";

export interface AdapterContext {
  caseId: string;
  sourceRunId: string;
  signal: AbortSignal;
  emitProgress: (text: string, url?: string) => void;
  mode: "live" | "demo";
  now: Date;
}

export interface AdapterInput {
  gstin?: string;
  pan?: string;
  cin?: string;
  udyamNumber?: string;
  legalName?: string;
  tradeName?: string;
  stateCode?: string;
  city?: string;
  directors?: { din?: string; name: string }[];
}

export type AdapterStatus =
  "succeeded" | "not_found" | "captcha_blocked" | "failed" | "timeout" | "skipped";

export interface AdapterResult<T> {
  status: AdapterStatus;
  normalized?: T;
  rawOutput?: unknown;
  evidenceUrl?: string;
  error?: string;
  tinyfishRunId?: string;
  isReplay: boolean;
}

export interface SourceAdapter<T> {
  id: AdapterId;
  label: string;
  // OR of ANDs, e.g. [["gstin"], ["cin", "legalName"]]
  requires: (keyof AdapterInput)[][];
  tier: "agent" | "search_fetch" | "licensed_api";
  run(input: AdapterInput, ctx: AdapterContext): Promise<AdapterResult<T>>;
}

// What the scoring engine receives per adapter after a run (or carried forward by the monitor)
export interface SourceOutcome {
  sourceRunId: string;
  status: SourceStatus;
  normalized?: unknown;
  evidenceUrl?: string;
  retrievedAt: string;
  isReplay: boolean;
}

export type SourceOutcomes = Partial<Record<AdapterId, SourceOutcome>>;
