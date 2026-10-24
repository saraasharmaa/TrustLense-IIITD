import { describe, expect, it, vi } from "vitest";
import { hasDatabase } from "@/lib/testing/db";
import { cacheKey, withCache } from "./cache";
import type { AdapterContext, AdapterResult, SourceAdapter } from "./types";

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

function adapterWith(result: AdapterResult<unknown>) {
  const run = vi.fn().mockResolvedValue(result);
  const adapter: SourceAdapter<unknown> = {
    id: "gst",
    label: "gst",
    requires: [],
    tier: "agent",
    run,
  };
  return { adapter, run };
}

describe("cacheKey", () => {
  it("prefers the strongest identifier and lowercases", () => {
    expect(cacheKey("gst", { gstin: "33AABCS7345M1Z3", legalName: "X" })).toBe(
      "gst:33aabcs7345m1z3",
    );
    expect(cacheKey("news", { legalName: "Acme Ltd" })).toBe("news:acme ltd");
  });
});

describe.skipIf(!hasDatabase)("withCache", () => {
  const input = () => ({ gstin: `CACHE${Math.random()}` });

  it("serves a repeat run from the cache with the original retrieval time", async () => {
    const { adapter, run } = adapterWith({
      status: "succeeded",
      normalized: { a: 1 },
      isReplay: false,
    });
    const cached = withCache(adapter, 60);
    const i = input();
    await cached.run(i, ctx());
    const second = await cached.run(i, ctx());
    expect(run).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ status: "succeeded", normalized: { a: 1 }, isReplay: false });
    expect(second.retrievedAt).toBeDefined();
  });

  it("does not cache failures or captcha blocks", async () => {
    const { adapter, run } = adapterWith({ status: "captcha_blocked", isReplay: false });
    const cached = withCache(adapter, 60);
    const i = input();
    await cached.run(i, ctx());
    await cached.run(i, ctx());
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("ignores entries older than the ttl", async () => {
    const { adapter, run } = adapterWith({ status: "not_found", isReplay: false });
    const cached = withCache(adapter, 0);
    const i = input();
    await cached.run(i, ctx());
    await new Promise((r) => setTimeout(r, 20));
    await cached.run(i, ctx());
    expect(run).toHaveBeenCalledTimes(2);
  });
});
