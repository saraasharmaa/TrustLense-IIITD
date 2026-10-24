import { SeverityChip } from "@/components/SeverityChip";
import { Card } from "@/components/ui/card";
import type { ViewFinding } from "@/lib/client/schemas";

const RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;

export function FindingsFeed({ findings, running }: { findings: ViewFinding[]; running: boolean }) {
  const sorted = [...findings].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Findings
      </h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {running ? "Findings appear here once the agents finish." : "No findings were recorded."}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-start gap-2">
                <SeverityChip severity={f.severity} />
                <span>{f.title}</span>
              </span>
              {f.appliedPenalty > 0 && (
                <span className="shrink-0 font-mono text-muted-foreground">
                  −{f.appliedPenalty}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
