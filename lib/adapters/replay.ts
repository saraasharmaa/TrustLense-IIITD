import { findDemoCompanyByGstin, findSnapshot } from "@/lib/demo/fixtures";
import type { AdapterId } from "@/lib/types";
import { adapterSchemas, parseWith } from "./schemas";
import type { AdapterResult, AdapterStatus, SourceAdapter } from "./types";

export interface ReplayOptions {
  snapshot?: string;
  // Simulated source latency range; tests pass 0 to run instantly
  delayMs?: [min: number, max: number];
}

const LABELS: Record<AdapterId, string> = {
  gst: "GST taxpayer search",
  mca: "MCA company master data",
  legal: "Courts and insolvency",
  udyam: "Udyam verification",
  news: "Adverse media",
  regulatory: "Regulatory lists",
};

const REQUIRES: Record<AdapterId, SourceAdapter<unknown>["requires"]> = {
  gst: [["gstin"]],
  mca: [["gstin"]],
  legal: [["gstin"]],
  udyam: [["gstin"]],
  news: [["gstin"]],
  regulatory: [["gstin"]],
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

// Fixtures say "ok" where live adapters say "succeeded"
function toAdapterStatus(pageStatus: unknown): AdapterStatus {
  return pageStatus === "ok" ? "succeeded" : (pageStatus as AdapterStatus);
}

export function replayUrl(adapter: AdapterId, companyKey: string): string {
  return `https://example.invalid/replay/${adapter}/${companyKey}`;
}

export function replayAdapter(id: AdapterId, options: ReplayOptions = {}): SourceAdapter<unknown> {
  const [minDelay, maxDelay] = options.delayMs ?? [1000, 6000];
  const snapshotLabel = options.snapshot ?? "t0";

  return {
    id,
    label: LABELS[id],
    requires: REQUIRES[id],
    tier: "agent",
    async run(input, ctx): Promise<AdapterResult<unknown>> {
      const company = input.gstin ? findDemoCompanyByGstin(input.gstin) : undefined;
      if (!company) {
        return { status: "skipped", isReplay: true, error: "No replay fixture for this GSTIN" };
      }
      const payload = findSnapshot(company, snapshotLabel)?.adapters[id];
      if (!payload) {
        return {
          status: "skipped",
          isReplay: true,
          error: `Replay snapshot ${snapshotLabel} has no ${id} data`,
        };
      }

      ctx.emitProgress(`Replaying recorded result: ${LABELS[id]} (demo data)`);
      const wait = minDelay + Math.random() * (maxDelay - minDelay);
      await sleep(wait, ctx.signal);

      const normalized = parseWith(adapterSchemas[id], payload, `${id} replay fixture`);
      return {
        status: toAdapterStatus(normalized.status),
        normalized,
        rawOutput: payload,
        evidenceUrl: replayUrl(id, company.key),
        isReplay: true,
      };
    },
  };
}
