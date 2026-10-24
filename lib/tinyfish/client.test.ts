import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/lib/errors";

const KEY = "tf-secret-key-123";

function sse(...events: object[]): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(text, { headers: { "Content-Type": "text/event-stream" } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgres://x");
  vi.stubEnv("TINYFISH_API_KEY", KEY);
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

async function load() {
  return import("./client");
}

describe("runAgent", () => {
  it("sends the key header and returns the final result with the run id", async () => {
    fetchMock.mockResolvedValue(
      sse(
        { type: "STARTED", run_id: "r1" },
        { type: "PROGRESS", run_id: "r1", purpose: "Opening the search page" },
        { type: "HEARTBEAT" },
        { type: "COMPLETE", run_id: "r1", status: "COMPLETED", result: { status: "ok" } },
      ),
    );
    const events: string[] = [];
    const { runAgent } = await load();
    const result = await runAgent({
      url: "https://x.example",
      goal: "g",
      onEvent: (e) => events.push(e.text),
    });

    expect(result).toEqual({ runId: "r1", resultJson: { status: "ok" } });
    expect(events).toEqual(["Opening the search page"]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agent.tinyfish.ai/v1/automation/run-sse");
    expect(init.headers["X-API-Key"]).toBe(KEY);
    expect(JSON.parse(init.body)).toMatchObject({ url: "https://x.example", goal: "g" });
  });

  it("turns a COMPLETE event with an error into an AppError carrying the TinyFish code", async () => {
    fetchMock.mockResolvedValue(
      sse({
        type: "COMPLETE",
        run_id: "r2",
        status: "FAILED",
        error: { code: "SITE_BLOCKED", message: "blocked" },
      }),
    );
    const { runAgent } = await load();
    await expect(runAgent({ url: "https://x.example", goal: "g" })).rejects.toMatchObject({
      code: "upstream_unavailable",
      details: { tinyfishCode: "SITE_BLOCKED", runId: "r2" },
    });
  });

  it("reports a stream that ends before COMPLETE", async () => {
    fetchMock.mockResolvedValue(sse({ type: "STARTED", run_id: "r3" }));
    const { runAgent } = await load();
    await expect(runAgent({ url: "https://x.example", goal: "g" })).rejects.toThrow(/ended before/);
  });

  it("maps HTTP errors without leaking the key", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "INVALID_API_KEY", message: "bad key" } }, 401),
    );
    const { runAgent } = await load();
    const err = (await runAgent({ url: "https://x.example", goal: "g" }).catch(
      (e: unknown) => e,
    )) as AppError;
    expect(err.name).toBe("AppError");
    expect(err.message).toContain("401");
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect(err.message).not.toContain(KEY);
  });

  it("refuses to call out without a configured key", async () => {
    vi.stubEnv("TINYFISH_API_KEY", "");
    vi.resetModules();
    const { runAgent } = await load();
    await expect(runAgent({ url: "https://x.example", goal: "g" })).rejects.toThrow(
      /not configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("search", () => {
  it("queries with GET params and returns trimmed hits", async () => {
    fetchMock.mockResolvedValue(
      json({
        results: [
          { position: 1, site_name: "Site", title: "T1", snippet: "S1", url: "https://a.example" },
          { position: 2, site_name: "Site", title: "T2", snippet: "S2", url: "https://b.example" },
        ],
      }),
    );
    const { search } = await load();
    const hits = await search("acme fraud", { limit: 1 });
    expect(hits).toEqual([
      { position: 1, title: "T1", url: "https://a.example", snippet: "S1", siteName: "Site" },
    ]);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.search.tinyfish.ai?query=acme+fraud");
  });
});

describe("fetchPage", () => {
  it("returns the page text", async () => {
    fetchMock.mockResolvedValue(
      json({
        results: [
          { url: "https://a.example", final_url: "https://a.example/x", title: "T", text: "body" },
        ],
        errors: [],
      }),
    );
    const { fetchPage } = await load();
    expect(await fetchPage("https://a.example")).toEqual({
      url: "https://a.example",
      finalUrl: "https://a.example/x",
      title: "T",
      text: "body",
    });
  });

  it("throws with the per-url reason when nothing was fetched", async () => {
    fetchMock.mockResolvedValue(
      json({ results: [], errors: [{ url: "https://a.example", error: "timeout" }] }),
    );
    const { fetchPage } = await load();
    await expect(fetchPage("https://a.example")).rejects.toThrow(/timeout/);
  });
});
