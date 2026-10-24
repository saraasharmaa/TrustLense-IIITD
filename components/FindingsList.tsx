import { ReplayBadge } from "@/components/ReplayBadge";
import { SeverityChip } from "@/components/SeverityChip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ViewFinding } from "@/lib/client/schemas";

const RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;

function Evidence({ finding }: { finding: ViewFinding }) {
  return (
    <ul className="space-y-2">
      {finding.evidence.map((e) => (
        <li key={`${e.url}-${e.excerpt}`} className="rounded-md bg-slate-50 p-3 text-sm">
          <p>“{e.excerpt}”</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
              {e.adapter.toUpperCase()} source
            </a>
            <span>retrieved {new Date(e.retrievedAt).toLocaleString()}</span>
            {e.isReplay && <ReplayBadge />}
          </p>
        </li>
      ))}
    </ul>
  );
}

function FindingRow({ finding }: { finding: ViewFinding }) {
  return (
    <li id={`finding-${finding.id}`}>
      <details className="rounded-lg border">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
          <SeverityChip severity={finding.severity} />
          {finding.hardStop && <Badge tone="critical">Hard stop</Badge>}
          <span className="font-medium">{finding.title}</span>
          {finding.appliedPenalty > 0 && (
            <span className="ml-auto font-mono text-sm text-muted-foreground">
              −{finding.appliedPenalty}
            </span>
          )}
        </summary>
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          <p>
            <span className="font-mono text-xs">{finding.ruleId}</span> · {finding.detail}
          </p>
          <p className="text-xs text-muted-foreground">
            Confidence {Math.round(finding.confidence * 100)}%
          </p>
          <Evidence finding={finding} />
        </div>
      </details>
    </li>
  );
}

export function FindingsList({ findings }: { findings: ViewFinding[] }) {
  const sorted = [...findings].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Findings and evidence</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No findings were recorded for this check.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      )}
    </Card>
  );
}
