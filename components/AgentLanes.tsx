import { GstManualEntry } from "@/components/GstManualEntry";
import { ReplayBadge } from "@/components/ReplayBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ADAPTER_LABEL, LANE_ORDER, STATUS_LABEL } from "@/lib/client/labels";
import type { CaseView } from "@/lib/client/schemas";

interface Props {
  runs: CaseView["sourceRuns"];
  progress: Record<string, string>;
  caseDone: boolean;
  caseId: string;
  mode: "live" | "demo";
  onChanged: () => void;
}

const UNBLOCKABLE = ["captcha_blocked", "failed", "timeout"];

export function AgentLanes({ runs, progress, caseDone, caseId, mode, onChanged }: Props) {
  return (
    <Card className="space-y-1 p-0">
      <h2 className="px-5 pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Agents
      </h2>
      <ul aria-live="polite" className="divide-y">
        {LANE_ORDER.map((adapter) => {
          const run = runs.find((r) => r.adapter === adapter);
          // A source that never started in a finished case was not requested, so say so
          const status = run?.status ?? (caseDone ? "skipped" : "queued");
          const { text, tone } = STATUS_LABEL[status];
          const detail =
            status === "running"
              ? progress[adapter]
              : (run?.error ?? (caseDone && !run ? "Not part of this check" : null));
          return (
            <li key={adapter} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium">{ADAPTER_LABEL[adapter]}</p>
                {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
                {adapter === "gst" &&
                  mode === "live" &&
                  caseDone &&
                  run &&
                  UNBLOCKABLE.includes(run.status) && (
                    <GstManualEntry caseId={caseId} onSaved={onChanged} />
                  )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {run?.isReplay && <ReplayBadge />}
                {run?.isManual && <Badge tone="medium">Entered by analyst</Badge>}
                <Badge tone={tone}>{text}</Badge>
                {run?.durationMs != null && (
                  <span className="text-xs text-muted-foreground">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
