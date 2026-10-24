import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQueries, dedupeHits, newsAdapter } from "./news";
import type { AdapterContext } from "./types";

const mocks = vi.hoisted(() => ({ search: vi.fn(), fetchPage: vi.fn(), classifyArticle: vi.fn() }));
vi.mock("@/lib/tinyfish/client", () => ({ search: mocks.search, fetchPage: mocks.fetchPage }));
vi.mock("@/lib/llm/classify-news", () => ({ classifyArticle: mocks.classifyArticle }));

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

const hit = (n: number, extra = {}) => ({
  position: n,
  title: `Title ${n}`,
  url: `https://news.example/a${n}`,
  snippet: `Snippet ${n}`,
  siteName: "News",
  ...extra,
});

const verdict = {
  category: "fraud",
  severity: "high",
  entityMatchConfidence: 0.9,
  publishedDate: "2026-05-01",
  reason: "r",
};

beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));

describe("buildQueries", () => {
  it("builds the docs/06 queries, adding trade name and the first two directors", () => {
    const queries = buildQueries({
      legalName: "Acme Pvt Ltd",
      tradeName: "Acme",
      city: "Pune",
      directors: [{ name: "A" }, { name: "B" }, { name: "C" }],
    });
    expect(queries).toHaveLength(5);
    expect(queries[1]).toBe('"Acme Pvt Ltd" Pune news');
    expect(queries.at(-1)).toBe('"B" "Acme Pvt Ltd"');
  });
});

describe("dedupeHits", () => {
  it("drops repeated urls and titles and interleaves queries", () => {
    const a = [hit(1), hit(2)];
    const b = [
      hit(3, { url: "https://news.example/a1?utm=x" }),
      hit(4, { title: "title 2" }),
      hit(5),
    ];
    expect(dedupeHits([a, b]).map((h) => h.position)).toEqual([1, 2, 5]);
  });
});

describe("newsAdapter", () => {
  it("returns not_found when the search finds nothing", async () => {
    mocks.search.mockResolvedValue([]);
    const result = await newsAdapter.run({ legalName: "Acme" }, ctx());
    expect(result).toMatchObject({ status: "not_found", normalized: { status: "not_found" } });
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });

  it("classifies fetched articles into the news output", async () => {
    mocks.search.mockResolvedValue([hit(1)]);
    mocks.fetchPage.mockResolvedValue({ text: "article body" });
    mocks.classifyArticle.mockResolvedValue(verdict);
    const result = await newsAdapter.run({ legalName: "Acme" }, ctx());
    expect(result.status).toBe("succeeded");
    expect(result.normalized).toMatchObject({
      status: "ok",
      articles: [
        {
          url: "https://news.example/a1",
          severity: "high",
          publishedDate: "2026-05-01",
          snippet: "Snippet 1",
        },
      ],
    });
    expect(result.evidenceUrl).toBe("https://news.example/a1");
  });

  it("keeps readable articles when some fail, and says how many were unreadable", async () => {
    mocks.search.mockResolvedValue([hit(1), hit(2)]);
    mocks.fetchPage
      .mockResolvedValueOnce({ text: "ok" })
      .mockRejectedValueOnce(new Error("paywall"));
    mocks.classifyArticle.mockResolvedValue(verdict);
    const result = await newsAdapter.run({ legalName: "Acme" }, ctx());
    expect(result.status).toBe("succeeded");
    expect((result.rawOutput as { unreadable: number }).unreadable).toBe(1);
  });

  it("fails honestly when nothing could be read, instead of reporting a clean result", async () => {
    mocks.search.mockResolvedValue([hit(1)]);
    mocks.fetchPage.mockRejectedValue(new Error("blocked"));
    const result = await newsAdapter.run({ legalName: "Acme" }, ctx());
    expect(result.status).toBe("failed");
    expect(result.error).toContain("blocked");
  });
});
