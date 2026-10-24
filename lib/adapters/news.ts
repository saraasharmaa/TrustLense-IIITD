import pLimit from "p-limit";
import { classifyArticle, type NewsTarget } from "@/lib/llm/classify-news";
import { fetchPage, search } from "@/lib/tinyfish/client";
import type { SearchHit } from "@/lib/tinyfish/types";
import type { NewsData } from "./schemas";
import type { AdapterInput, SourceAdapter } from "./types";

const HITS_PER_QUERY = 6;
const MAX_ARTICLES = 10;
const FETCH_CONCURRENCY = 4;
const EXCERPT_CHARS = 300;

export function buildQueries(input: AdapterInput): string[] {
  const name = input.legalName ?? "";
  const place = input.city ?? "";
  const queries = [
    `"${name}" fraud OR default OR insolvency OR NCLT OR "cheque bounce" OR raid`,
    `"${name}" ${place} news`,
  ];
  if (input.tradeName) queries.push(`"${input.tradeName}" ${place} complaint OR dispute`);
  for (const director of (input.directors ?? []).slice(0, 2)) {
    queries.push(`"${director.name}" "${name}"`);
  }
  return queries.map((q) => q.replace(/\s+/g, " ").trim());
}

function urlKey(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.pathname}`.replace(/\/$/, "").toLowerCase();
}

// Results from different queries interleave so no single query fills the quota
export function dedupeHits(perQuery: SearchHit[][]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  const longest = Math.max(0, ...perQuery.map((hits) => hits.length));
  for (let i = 0; i < longest; i++) {
    for (const hits of perQuery) {
      const hit = hits[i];
      if (!hit) continue;
      const keys = [urlKey(hit.url), hit.title.trim().toLowerCase()];
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      out.push(hit);
    }
  }
  return out.slice(0, MAX_ARTICLES);
}

function toTarget(input: AdapterInput): NewsTarget {
  return {
    legalName: input.legalName ?? "",
    tradeName: input.tradeName,
    city: input.city,
    state: input.stateCode,
    directors: input.directors?.map((d) => d.name),
  };
}

export const newsAdapter: SourceAdapter<NewsData> = {
  id: "news",
  label: "Adverse media",
  requires: [["legalName"]],
  tier: "search_fetch",
  async run(input, ctx) {
    const { signal } = ctx;
    const queries = buildQueries(input);
    ctx.emitProgress(`Searching the web with ${queries.length} queries`);
    const perQuery = await Promise.all(
      queries.map((q) => search(q, { limit: HITS_PER_QUERY, signal })),
    );
    const hits = dedupeHits(perQuery);

    if (hits.length === 0) {
      return {
        status: "not_found",
        normalized: { status: "not_found" },
        rawOutput: { queries },
        isReplay: false,
      };
    }

    ctx.emitProgress(`Reading ${hits.length} articles`);
    const limit = pLimit(FETCH_CONCURRENCY);
    const target = toTarget(input);
    const settled = await Promise.allSettled(
      hits.map((hit) =>
        limit(async () => {
          const page = await fetchPage(hit.url, { signal });
          const verdict = await classifyArticle(
            target,
            { title: hit.title, text: page.text },
            signal,
          );
          return {
            title: hit.title,
            url: hit.url,
            publishedDate: verdict.publishedDate,
            source: hit.siteName,
            snippet: (hit.snippet || page.text).slice(0, EXCERPT_CHARS),
            category: verdict.category,
            severity: verdict.severity,
            entityMatchConfidence: verdict.entityMatchConfidence,
          };
        }),
      ),
    );

    if (signal.aborted) throw signal.reason;
    const articles = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (articles.length === 0) {
      const reason = settled.find((r) => r.status === "rejected") as
        PromiseRejectedResult | undefined;
      return {
        status: "failed",
        error:
          `None of ${hits.length} articles could be read and classified: ${String(reason?.reason?.message ?? "unknown")}`.slice(
            0,
            300,
          ),
        rawOutput: { queries, hits },
        isReplay: false,
      };
    }

    return {
      status: "succeeded",
      normalized: { status: "ok", articles },
      rawOutput: { queries, hits, unreadable: hits.length - articles.length },
      evidenceUrl: articles[0]?.url,
      isReplay: false,
    };
  },
};
