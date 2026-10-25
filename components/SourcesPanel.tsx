import { ReplayBadge } from "@/components/ReplayBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ADAPTER_LABEL, STATUS_LABEL } from "@/lib/client/labels";
import type { CaseView } from "@/lib/client/schemas";

export function SourcesPanel({ runs }: { runs: CaseView["sourceRuns"] }) {
  return (
    <Card className="space-y-3 overflow-x-auto">
      <h2 className="text-lg font-semibold">Sources</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-1 pr-3">Source</th>
            <th className="py-1 pr-3">Status</th>
            <th className="py-1 pr-3">Attempts</th>
            <th className="py-1 pr-3">Duration</th>
            <th className="py-1">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="py-2 pr-3 font-medium">{ADAPTER_LABEL[run.adapter]}</td>
              <td className="py-2 pr-3">
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_LABEL[run.status].tone}>
                    {STATUS_LABEL[run.status].text}
                  </Badge>
                  {run.isReplay && <ReplayBadge />}
                  {run.isManual && <Badge tone="medium">Entered by analyst</Badge>}
                </span>
              </td>
              <td className="py-2 pr-3">{run.attempt}</td>
              <td className="py-2 pr-3">
                {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : "–"}
              </td>
              <td className="py-2 text-muted-foreground">{run.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
