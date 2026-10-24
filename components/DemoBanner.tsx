"use client";

import { Health } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

export function DemoBanner() {
  const { result } = useFetch("/api/health", Health);
  if (result.state !== "ready" || !result.data.demoMode) return null;
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      Demo mode — results come from synthetic replay data, not live checks.
    </div>
  );
}
