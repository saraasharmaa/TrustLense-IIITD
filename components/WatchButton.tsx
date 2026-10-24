"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/api";
import { Watched } from "@/lib/client/schemas";

const DAILY = 24;

export function WatchButton({
  caseId,
  watching,
  onWatched,
}: {
  caseId: string;
  watching: boolean;
  onWatched: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function watch() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/cases/${caseId}/watch`, { frequencyHours: DAILY }, Watched);
      onWatched();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to the watchlist");
    } finally {
      setBusy(false);
    }
  }

  if (watching) {
    return (
      <Link href="/watchlist" className="text-sm font-medium text-teal-700 underline">
        Watching daily · open watchlist
      </Link>
    );
  }
  return (
    <div className="space-y-1">
      <Button onClick={() => void watch()} disabled={busy} variant="outline">
        {busy ? "Adding…" : "Watch this company"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
