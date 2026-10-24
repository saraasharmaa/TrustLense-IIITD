import { describe, expect, it, vi } from "vitest";
import type { AdapterResult, SourceAdapter } from "@/lib/adapters/types";
import { runAdapter } from "./retry";

const baseCtx = {
  caseId: "c",
  sourceRunId: "s",
  emitProgress: () => {},
  mode: "live" as const,
  now: new Date(),
};
const options = { timeoutMs: 50, backoffMs: 1 };

function adapterReturning(...results: (AdapterResult<unknown> | Error)[]): SourceAdapter<unknown> {
  const run = vi.fn();
  results.forEach((r) =>
    r instanceof Error ? run.mockRejectedValueOnce(r) : run.mockResolvedValueOnce(r),
  );
  return { id: "gst", label: "gst", requires: [], tier: "agent", run };
}

describe("runAdapter", () => {
  it("returns a success without retrying", async () => {
    const adapter = adapterReturning({ status: "succeeded", isReplay: false });
    const result = await runAdapter(adapter, {}, baseCtx, options);
    expect(result).toMatchObject({ status: "succeeded", attempt: 1 });
    expect(adapter.run).toHaveBeenCalledTimes(1);
  });

  it("turns a thrown error into failed and retries once", async () => {
    const adapter = adapterReturning(new Error("boom"), { status: "succeeded", isReplay: false });
    const result = await runAdapter(adapter, {}, baseCtx, options);
    expect(result).toMatchObject({ status: "succeeded", attempt: 2 });
  });

  it("gives up after the second failure with the error message", async () => {
    const adapter = adapterReturning(new Error("one"), new Error("two"));
    const result = await runAdapter(adapter, {}, baseCtx, options);
    expect(result).toMatchObject({ status: "failed", attempt: 2, error: "two" });
  });

  it.each(["captcha_blocked", "not_found"] as const)("does not retry %s", async (status) => {
    const adapter = adapterReturning({ status, isReplay: false });
    const result = await runAdapter(adapter, {}, baseCtx, options);
    expect(result).toMatchObject({ status, attempt: 1 });
    expect(adapter.run).toHaveBeenCalledTimes(1);
  });

  it("marks a hung adapter as timeout after retrying", async () => {
    const hung: SourceAdapter<unknown> = {
      id: "gst",
      label: "gst",
      requires: [],
      tier: "agent",
      run: () => new Promise(() => {}),
    };
    const result = await runAdapter(hung, {}, baseCtx, options);
    expect(result).toMatchObject({ status: "timeout", attempt: 2 });
  });

  it("reports each failed attempt and whether a retry follows", async () => {
    const seen: [number, boolean][] = [];
    const adapter = adapterReturning(new Error("a"), new Error("b"));
    await runAdapter(adapter, {}, baseCtx, {
      ...options,
      onAttemptFailed: (_r, attempt, willRetry) => seen.push([attempt, willRetry]),
    });
    expect(seen).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it("stops retrying when the case is aborted", async () => {
    const controller = new AbortController();
    const adapter = adapterReturning(new Error("x"), { status: "succeeded", isReplay: false });
    controller.abort(new Error("case cap"));
    const result = await runAdapter(adapter, {}, baseCtx, {
      ...options,
      caseSignal: controller.signal,
    });
    expect(result.attempt).toBe(1);
  });
});
