import type { Tone } from "@/components/ui/badge";
import type { AdapterId, Severity, SourceStatus } from "@/lib/types";

// Fixed lane order (docs/08 section 8)
export const LANE_ORDER: AdapterId[] = ["gst", "news", "mca", "legal", "udyam", "regulatory"];

export const ADAPTER_LABEL: Record<AdapterId, string> = {
  gst: "GST",
  news: "News",
  mca: "MCA",
  legal: "Courts & insolvency",
  udyam: "Udyam",
  regulatory: "Regulatory lists",
};

export const STATUS_LABEL: Record<SourceStatus | "queued", { text: string; tone: Tone }> = {
  queued: { text: "Queued", tone: "neutral" },
  pending: { text: "Queued", tone: "neutral" },
  running: { text: "Running", tone: "info" },
  succeeded: { text: "Done", tone: "ok" },
  not_found: { text: "No record", tone: "neutral" },
  captcha_blocked: { text: "Blocked (CAPTCHA)", tone: "medium" },
  failed: { text: "Could not verify", tone: "high" },
  timeout: { text: "Timed out", tone: "medium" },
  skipped: { text: "Skipped", tone: "neutral" },
  carried_forward: { text: "Carried forward", tone: "neutral" },
};

// Colour is never the only cue: each severity has an icon and a label
export const SEVERITY_LABEL: Record<Severity, { text: string; icon: string; tone: Tone }> = {
  info: { text: "Info", icon: "ⓘ", tone: "info" },
  low: { text: "Low", icon: "▲", tone: "low" },
  medium: { text: "Medium", icon: "▲▲", tone: "medium" },
  high: { text: "High", icon: "⬣", tone: "high" },
  critical: { text: "Critical", icon: "✖", tone: "critical" },
};

export const GRADE_COLOR: Record<string, string> = {
  A: "#15803D",
  B: "#65A30D",
  C: "#D97706",
  D: "#B91C1C",
};
