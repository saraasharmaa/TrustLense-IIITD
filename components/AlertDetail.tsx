"use client";

import Link from "next/link";
import { SeverityChip } from "@/components/SeverityChip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GRADE_COLOR } from "@/lib/client/labels";
import { Alerts, type AlertItem } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

function Snapshot({
  label,
  score,
  grade,
  caseId,
}: {
  label: string;
  score: number;
  grade: string;
  caseId: string;
}) {
  return (
    <Card className="space-y-1 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-4xl font-semibold">{score}</p>
      <p className="font-semibold" style={{ color: GRADE_COLOR[grade] }}>
        Grade {grade}
      </p>
      <Link href={`/cases/${caseId}`} className="text-sm underline">
        Open report
      </Link>
    </Card>
  );
}

function FindingChanges({
  title,
  items,
}: {
  title: string;
  items: AlertItem["change"]["newFindings"];
}) {
  return (
    <Card className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((f) => (
            <li key={f.ruleId}>
              <span className="font-mono text-xs">{f.ruleId}</span> {f.title}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AlertDetail({ alertId }: { alertId: string }) {
  const { result } = useFetch("/api/alerts?limit=100", Alerts);

  if (result.state === "loading") return <Skeleton className="h-64 w-full" />;
  if (result.state === "error")
    return (
      <p role="alert" className="text-red-700">
        Could not load the alert: {result.message}
      </p>
    );

  const alert = result.data.alerts.find((a) => a.id === alertId);
  if (!alert) return <p className="text-muted-foreground">This alert was not found.</p>;

  const { change } = alert;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={alert.severity} />
          {alert.isSimulated && <Badge tone="replay">Simulated</Badge>}
          {change.hardStopAppeared && <Badge tone="critical">Hard stop</Badge>}
        </div>
        <h1 className="text-2xl font-semibold">{alert.title}</h1>
        <p className="text-muted-foreground">
          {alert.subject.legalName} · grade {change.gradeBefore} → {change.gradeAfter}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Snapshot
          label="Before"
          score={change.scoreBefore}
          grade={change.gradeBefore}
          caseId={alert.previousCaseId}
        />
        <Snapshot
          label="After"
          score={change.scoreAfter}
          grade={change.gradeAfter}
          caseId={alert.caseId}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FindingChanges title="New findings" items={change.newFindings} />
        <FindingChanges title="Resolved findings" items={change.resolvedFindings} />
      </div>
    </div>
  );
}
