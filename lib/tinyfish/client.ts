// The only module that talks to TinyFish. Shapes verified against docs.tinyfish.ai (see PROGRESS.md).
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { readSseData } from "./sse";
import type { AgentRunOptions, AgentRunResult, FetchedPage, SearchHit } from "./types";

const AGENT_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";
const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const EVENT_INTERVAL_MS = 500;

const RunError = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  category: z.string().optional(),
  retry_after: z.number().nullable().optional(),
});

const AgentEvent = z.object({
  type: z.string(),
  run_id: z.string().optional(),
  purpose: z.string().optional(),
  status: z.string().optional(),
  result: z.unknown().optional(),
  error: RunError.nullish(),
});

const SearchResponse = z.object({
  results: z.array(
    z.object({
      position: z.number(),
      site_name: z.string().default(""),
      title: z.string(),
      snippet: z.string().default(""),
      url: z.string(),
    }),
  ),
});

const FetchResponse = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      final_url: z.string().optional(),
      title: z.string().nullish(),
      text: z.string(),
    }),
  ),
  errors: z.array(z.object({ url: z.string(), error: z.string() })).default([]),
});

function headers(): Record<string, string> {
  const key = env().TINYFISH_API_KEY;
  if (!key) throw new AppError("upstream_unavailable", "TINYFISH_API_KEY is not configured");
  return { "X-API-Key": key, "Content-Type": "application/json" };
}

// Never include request headers or bodies here: they carry the key
async function failFromResponse(res: Response, what: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const parsed = RunError.safeParse(body?.error);
  const code = parsed.success ? parsed.data.code : undefined;
  const message = parsed.success ? parsed.data.message : undefined;
  throw new AppError(
    "upstream_unavailable",
    `${what} returned HTTP ${res.status}${message ? `: ${message}` : ""}`,
    {
      httpStatus: res.status,
      tinyfishCode: code,
    },
  );
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const body = {
    url: opts.url,
    goal: opts.goal,
    browser_profile: opts.browserProfile,
    proxy_config: opts.proxyCountry
      ? { enabled: true, type: "tinyfish", country_code: opts.proxyCountry }
      : undefined,
  };
  const res = await fetch(AGENT_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) return failFromResponse(res, "TinyFish Agent");

  let runId: string | undefined;
  let lastEvent = 0;
  for await (const raw of readSseData(res.body)) {
    const event = AgentEvent.safeParse(raw);
    if (!event.success) continue;
    const { type, run_id, purpose, error, result } = event.data;
    runId = run_id ?? runId;

    if (type === "PROGRESS" && purpose && Date.now() - lastEvent >= EVENT_INTERVAL_MS) {
      lastEvent = Date.now();
      opts.onEvent?.({ text: purpose });
    }
    if (type === "COMPLETE") {
      if (error || event.data.status === "FAILED") {
        throw new AppError(
          "upstream_unavailable",
          `TinyFish run failed: ${error?.message ?? "unknown error"}`,
          {
            tinyfishCode: error?.code,
            category: error?.category,
            runId,
          },
        );
      }
      return { runId, resultJson: result };
    }
  }
  // The stream has no Last-Event-ID resume, so a cut stream is reported rather than guessed at
  throw new AppError("upstream_unavailable", "TinyFish stream ended before the run completed", {
    runId,
  });
}

export async function search(
  query: string,
  opts: { limit?: number; signal?: AbortSignal; news?: boolean } = {},
): Promise<SearchHit[]> {
  const params = new URLSearchParams({ query });
  if (opts.news) params.set("domain_type", "news");
  const res = await fetch(`${SEARCH_URL}?${params}`, { headers: headers(), signal: opts.signal });
  if (!res.ok) return failFromResponse(res, "TinyFish Search");

  const parsed = SearchResponse.parse(await res.json());
  return parsed.results.slice(0, opts.limit ?? 10).map((r) => ({
    position: r.position,
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    siteName: r.site_name,
  }));
}

export async function fetchPage(
  url: string,
  opts: { signal?: AbortSignal } = {},
): Promise<FetchedPage> {
  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ urls: [url], format: "markdown" }),
    signal: opts.signal,
  });
  if (!res.ok) return failFromResponse(res, "TinyFish Fetch");

  const parsed = FetchResponse.parse(await res.json());
  const page = parsed.results[0];
  if (!page) {
    const reason = parsed.errors[0]?.error ?? "no content returned";
    throw new AppError("upstream_unavailable", `TinyFish Fetch could not read the page: ${reason}`);
  }
  return {
    url: page.url,
    finalUrl: page.final_url ?? page.url,
    title: page.title ?? null,
    text: page.text,
  };
}
