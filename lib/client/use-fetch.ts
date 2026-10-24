"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { getJson } from "./api";

export type Loaded<T> =
  { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

// Loading, error and ready in one place so every view handles all three
export function useFetch<S extends z.ZodType>(url: string, schema: S, refreshMs?: number) {
  const [result, setResult] = useState<Loaded<z.output<S>>>({ state: "loading" });

  const load = useCallback(async () => {
    try {
      setResult({ state: "ready", data: await getJson(url, schema) });
    } catch (err) {
      setResult({ state: "error", message: err instanceof Error ? err.message : "Request failed" });
    }
  }, [url, schema]);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  return { result, reload: load };
}
