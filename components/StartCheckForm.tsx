"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GstinHint } from "@/components/GstinHint";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { postJson } from "@/lib/client/api";
import { CreatedCase, DemoCompanies } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";
import { validateCin } from "@/lib/identifiers/cin";
import { validateGstin } from "@/lib/identifiers/gstin";

export function StartCheckForm() {
  const router = useRouter();
  const [gstin, setGstin] = useState("");
  const [cin, setCin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { result: demos } = useFetch("/api/demo/companies", DemoCompanies);

  const valid = validateGstin(gstin).ok && (!cin.trim() || validateCin(cin).ok);

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await postJson("/api/cases", { gstin, cin: cin.trim() || null }, CreatedCase);
      router.push(`/cases/${created.caseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className="space-y-4">
      <label htmlFor="gstin" className="block text-sm font-medium">
        GSTIN
      </label>
      <input
        id="gstin"
        value={gstin}
        onChange={(e) => setGstin(e.target.value.toUpperCase())}
        placeholder="e.g. 33AABCS7345M1Z3"
        className="h-12 w-full rounded-md border bg-background px-3 font-mono text-lg"
        autoComplete="off"
      />
      <GstinHint value={gstin} />
      <label htmlFor="cin" className="block text-sm font-medium">
        CIN{" "}
        <span className="font-normal text-muted-foreground">
          (optional, needed for the live MCA check)
        </span>
      </label>
      <input
        id="cin"
        value={cin}
        onChange={(e) => setCin(e.target.value.toUpperCase())}
        placeholder="e.g. L17110MH1973PLC019786"
        className="h-12 w-full rounded-md border bg-background px-3 font-mono text-lg"
        autoComplete="off"
      />
      {cin.trim() && !validateCin(cin).ok && (
        <p role="alert" className="text-sm text-red-700">
          ✖ CIN must be 21 characters: L or U, 5 digits, state, year, type, number
        </p>
      )}
      <Button type="submit" disabled={!valid || busy} className="h-11 px-6">
        {busy ? "Starting…" : "Start check"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-2 pt-2">
        <p className="text-sm font-medium">Try a demo company</p>
        {demos.state === "loading" && <Skeleton className="h-9 w-72" />}
        {demos.state === "error" && (
          <p className="text-sm text-red-700">Demo companies unavailable: {demos.message}</p>
        )}
        {demos.state === "ready" && (
          <div className="flex flex-wrap gap-2">
            {demos.data.companies.map((c) => (
              <Button
                key={c.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGstin(c.gstin)}
              >
                {c.legalName.replace(" (Demo)", "")}
              </Button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
