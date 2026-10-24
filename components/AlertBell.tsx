"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alerts } from "@/lib/client/schemas";
import { useFetch } from "@/lib/client/use-fetch";

const POLL_MS = 20_000;
const TOAST_MS = 8_000;

export function AlertBell() {
  const { result } = useFetch("/api/alerts?unread=1", Alerts, POLL_MS);
  const seen = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (result.state !== "ready") return;
    const ids = new Set(result.data.alerts.map((a) => a.id));
    // The first load only records what already exists; later polls toast new critical alerts
    if (seen.current) {
      const fresh = result.data.alerts.find(
        (a) => !seen.current?.has(a.id) && a.severity === "critical",
      );
      if (fresh) {
        setToast({ id: fresh.id, text: `${fresh.subject.legalName}: ${fresh.title}` });
        setTimeout(() => setToast(null), TOAST_MS);
      }
    }
    seen.current = ids;
  }, [result]);

  const unread = result.state === "ready" ? result.data.unreadCount : 0;
  return (
    <>
      <Link
        href="/watchlist"
        className="relative rounded-md p-2 hover:bg-accent"
        aria-label={`Alerts, ${unread} unread`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </Link>
      {toast && (
        <Link
          href={`/alerts/${toast.id}`}
          role="alert"
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg bg-red-900 p-4 text-sm text-white shadow-lg"
        >
          <strong className="block">Critical alert</strong>
          {toast.text}
        </Link>
      )}
    </>
  );
}
