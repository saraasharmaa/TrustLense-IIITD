"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { GST_SEARCH_URL } from "@/lib/client/constants";

const STATUSES = ["Active", "Provisional", "Suspended", "Cancelled"] as const;

// The portal's CAPTCHA is solved by the analyst in their own browser; we only record what they read
export function GstManualEntry({ caseId, onSaved }: { caseId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("Active");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationStatus: status, registrationDate: date || null }),
    });
    if (res.ok) return onSaved();
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    setError(json?.error?.message ?? "Could not save the entry");
    setBusy(false);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Enter GST details yourself
      </Button>
    );
  }
  return (
    <form onSubmit={save} className="mt-2 space-y-2 rounded-md border bg-slate-50 p-3 text-sm">
      <p>
        The GST portal asks for a CAPTCHA, which we never bypass. Open the{" "}
        <a href={GST_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="underline">
          GST taxpayer search
        </a>
        , solve it yourself, then enter what it shows. The report will label this as
        analyst-entered.
      </p>
      <label className="block">
        Registration status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
          className="ml-2 rounded border bg-background px-2 py-1"
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Registration date (optional)
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ml-2 rounded border bg-background px-2 py-1"
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save entry"}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
