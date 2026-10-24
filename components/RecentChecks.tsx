"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentCases } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

export function RecentChecks() {
  const { result } = useFetch("/api/cases?limit=8", RecentCases);

  if (result.state === "loading") return <Skeleton className="h-24 w-full" />;
  if (result.state === "error") {
    return <p className="text-sm text-red-700">Could not load recent checks: {result.message}</p>;
  }
  if (result.data.cases.length === 0) {
    return <p className="text-sm text-muted-foreground">No checks yet. Start one above.</p>;
  }
  return (
    <ul className="divide-y rounded-xl border">
      {result.data.cases.map((c) => (
        <li key={c.id}>
          <Link
            href={`/cases/${c.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
          >
            <span>
              <span className="font-medium">{c.subject.legalName}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {c.subject.gstin}
              </span>
            </span>
            <span className="flex items-center gap-2 text-sm">
              {c.mode === "demo" && <Badge tone="replay">Replay</Badge>}
              {c.grade ? `${c.score} · ${c.grade}` : c.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
