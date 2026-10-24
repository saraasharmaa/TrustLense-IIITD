"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { postJson } from "@/lib/client/api";
import { GRADE_COLOR } from "@/lib/client/labels";
import { SimulatedChange, Watches } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

function Grade({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="font-semibold" style={{ color: GRADE_COLOR[grade] }}>
      {grade}
    </span>
  );
}

export function WatchTable() {
  const router = useRouter();
  const { result } = useFetch("/api/watches", Watches, 20_000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(watchId: string) {
    setBusyId(watchId);
    setError(null);
    try {
      const outcome = await postJson("/api/demo/simulate-change", { watchId }, SimulatedChange);
      router.push(`/alerts/${outcome.alertId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate a change");
      setBusyId(null);
    }
  }

  if (result.state === "loading") return <Skeleton className="h-24 w-full" />;
  if (result.state === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        Could not load the watchlist: {result.message}
      </p>
    );
  }
  if (result.data.watches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing watched yet. Open a report and click “Watch this company”.
      </p>
    );
  }
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-1 pr-3">Company</th>
            <th className="py-1 pr-3">Now</th>
            <th className="py-1 pr-3">Baseline</th>
            <th className="py-1 pr-3">Every</th>
            <th className="py-1 pr-3">Next run</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {result.data.watches.map((w) => (
            <tr key={w.id}>
              <td className="py-2 pr-3">
                <span className="font-medium">{w.subject.legalName}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {w.subject.gstin}
                </span>
              </td>
              <td className="py-2 pr-3">
                <Grade grade={w.currentGrade} />
              </td>
              <td className="py-2 pr-3">
                <Grade grade={w.baselineGrade} />
              </td>
              <td className="py-2 pr-3">
                {w.frequencyHours === 168 ? "week" : `${w.frequencyHours}h`}
              </td>
              <td className="py-2 pr-3">
                {w.nextRunAt ? new Date(w.nextRunAt).toLocaleString() : "–"}
              </td>
              <td className="py-2 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === w.id}
                  onClick={() => void simulate(w.id)}
                >
                  {busyId === w.id ? "Simulating…" : "Simulate change"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        Simulate change replays a recorded deterioration and is labelled Simulated.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
