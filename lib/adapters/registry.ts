import type { AdapterId } from "@/lib/types";
import { env } from "@/lib/env";
import { gstAdapter } from "./gst";
import { gstApiAdapter } from "./gst-api";
import { legalAdapter } from "./legal";
import { mcaAdapter } from "./mca";
import { mcaApiAdapter } from "./mca-api";
import { newsAdapter } from "./news";
import { replayAdapter, type ReplayOptions } from "./replay";
import type { AdapterInput, SourceAdapter } from "./types";

// Fixed lane order for the UI (docs/08 section 8)
export const ADAPTER_ORDER: AdapterId[] = ["gst", "news", "mca", "legal", "udyam", "regulatory"];

// Live adapters register here as they are built (M2 onwards)
const liveAdapters: Partial<Record<AdapterId, SourceAdapter<unknown>>> = {
  gst: gstAdapter,
  news: newsAdapter,
  mca: mcaAdapter,
  legal: legalAdapter,
};

// A source with no live adapter is reported as skipped, never filled with replay data
function unavailableAdapter(id: AdapterId): SourceAdapter<unknown> {
  return {
    id,
    label: id,
    requires: [],
    tier: "agent",
    run: async () => ({
      status: "skipped",
      isReplay: false,
      error: `No live ${id} adapter is available yet`,
    }),
  };
}

export function getAdapter(
  id: AdapterId,
  mode: "live" | "demo",
  replay: ReplayOptions = {},
): SourceAdapter<unknown> {
  if (mode === "demo") return replayAdapter(id, replay);
  // A licensed API key replaces the CAPTCHA-blocked portal agent for GST
  if (id === "gst" && env().GSTINAPI_API_KEY) return gstApiAdapter;
  if (id === "mca" && env().SANDBOX_API_KEY && env().SANDBOX_API_SECRET) return mcaApiAdapter;
  return liveAdapters[id] ?? unavailableAdapter(id);
}

export function hasRequiredInputs(adapter: SourceAdapter<unknown>, input: AdapterInput): boolean {
  if (adapter.requires.length === 0) return true;
  return adapter.requires.some((keys) => keys.every((key) => Boolean(input[key])));
}
