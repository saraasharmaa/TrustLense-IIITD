import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const TONES = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-slate-100 text-slate-700 border-slate-300",
  low: "bg-yellow-50 text-yellow-800 border-yellow-300",
  medium: "bg-orange-50 text-orange-800 border-orange-300",
  high: "bg-red-50 text-red-700 border-red-300",
  critical: "bg-red-900 text-white border-red-900",
  replay: "bg-amber-50 text-amber-900 border-amber-400",
  ok: "bg-green-50 text-green-800 border-green-300",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
