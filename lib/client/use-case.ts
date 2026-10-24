"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson } from "./api";
import { CaseView } from "./schemas";

const EVENT_TYPES = [
  "case.started",
  "source.started",
  "source.progress",
  "source.completed",
  "source.failed",
  "finding.created",
  "score.computed",
  "narrative.ready",
  "report.ready",
  "case.failed",
] as const;
const TERMINAL = ["report.ready", "case.failed"];
const REFRESH_DELAY_MS = 250;

export type CaseState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; view: CaseView; progress: Record<string, string> };

// Loads the case, then follows its SSE stream and refetches the view on every event, so the
// page after a refresh is rebuilt from the server rather than from missed events.
export function useCase(caseId: string) {
  const [view, setView] = useState<CaseView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      setView(await getJson(`/api/cases/${caseId}`, CaseView));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the case");
    }
  }, [caseId]);

  useEffect(() => {
    void reload();
    const source = new EventSource(`/api/cases/${caseId}/stream`);

    const onEvent = (raw: Event) => {
      const message = raw as MessageEvent<string>;
      const parsed = JSON.parse(message.data) as {
        type: string;
        data: { adapter?: string; text?: string };
      };
      if (parsed.type === "source.progress" && parsed.data.adapter && parsed.data.text) {
        setProgress((p) => ({ ...p, [parsed.data.adapter as string]: parsed.data.text as string }));
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void reload(), REFRESH_DELAY_MS);
      // The server ends the stream after these; closing stops the browser reconnecting forever
      if (TERMINAL.includes(parsed.type)) source.close();
    };
    EVENT_TYPES.forEach((type) => source.addEventListener(type, onEvent));

    return () => {
      source.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [caseId, reload]);

  const state: CaseState = view
    ? { state: "ready", view, progress }
    : error
      ? { state: "error", message: error }
      : { state: "loading" };
  return { state, reload };
}
