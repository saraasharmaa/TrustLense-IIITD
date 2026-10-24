"use client";

import Link from "next/link";
import { SeverityChip } from "@/components/SeverityChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alerts } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

export function AlertTimeline() {
  const { result, reload } = useFetch("/api/alerts?limit=50", Alerts, 20_000);

  async function acknowledge(id: string) {
    await fetch(`/api/alerts/${id}/ack`, { method: "POST" });
    void reload();
  }

  if (result.state === "loading") return <Skeleton className="h-24 w-full" />;
  if (result.state === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        Could not load alerts: {result.message}
      </p>
    );
  }
  if (result.data.alerts.length === 0)
    return <p className="text-sm text-muted-foreground">No alerts yet.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {result.data.alerts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/alerts/${a.id}`}
            className="flex flex-wrap items-center gap-2 hover:underline"
          >
            <SeverityChip severity={a.severity} />
            <span className="font-medium">{a.subject.legalName}</span>
            <span>{a.title}</span>
            <span className="font-mono text-sm">
              {a.change.gradeBefore} → {a.change.gradeAfter}
            </span>
            {a.isSimulated && <Badge tone="replay">Simulated</Badge>}
          </Link>
          <span className="flex items-center gap-3 text-xs text-muted-foreground">
            {new Date(a.createdAt).toLocaleString()}
            {!a.acknowledgedAt && (
              <Button size="sm" variant="ghost" onClick={() => void acknowledge(a.id)}>
                Acknowledge
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
