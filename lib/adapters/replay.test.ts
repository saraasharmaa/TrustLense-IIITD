import { describe, expect, it } from "vitest";
import type { AdapterContext } from "./types";
import { replayAdapter } from "./replay";

const SUNRISE = "33AABCS7345M1Z3";

function ctx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    caseId: "c",
    sourceRunId: "s",
    signal: new AbortController().signal,
    emitProgress: () => {},
    mode: "demo",
    now: new Date("2026-10-24"),
    ...overrides,
  };
}

const instant = { delayMs: [0, 0] as [number, number] };

describe("replayAdapter", () => {
  it("maps fixture status ok to succeeded and labels the result as replay", async () => {
    const result = await replayAdapter("gst", instant).run({ gstin: SUNRISE }, ctx());
    expect(result).toMatchObject({ status: "succeeded", isReplay: true });
    expect(result.evidenceUrl).toContain("/replay/gst/sunrise");
  });

  it("keeps not_found as not_found", async () => {
    const kaveri = "29AAECK9012P1ZZ";
    const result = await replayAdapter("udyam", instant).run({ gstin: kaveri }, ctx());
    expect(result.status).toBe("not_found");
  });

  it("skips with a reason when the GSTIN has no fixture", async () => {
    const result = await replayAdapter("gst", instant).run({ gstin: "27AAAAA0000A1Z5" }, ctx());
    expect(result).toMatchObject({ status: "skipped", isReplay: true });
    expect(result.error).toMatch(/No replay fixture/);
  });

  it("serves the t1 snapshot and skips adapters it does not contain", async () => {
    const options = { ...instant, snapshot: "t1" };
    const gst = await replayAdapter("gst", options).run({ gstin: SUNRISE }, ctx());
    const mca = await replayAdapter("mca", options).run({ gstin: SUNRISE }, ctx());
    expect(gst.normalized).toMatchObject({
      registrationStatus: expect.stringMatching(/suspended/i),
    });
    expect(mca.status).toBe("skipped");
  });

  it("stops waiting when the signal aborts", async () => {
    const controller = new AbortController();
    const pending = replayAdapter("gst", { delayMs: [5000, 5000] }).run(
      { gstin: SUNRISE },
      ctx({ signal: controller.signal }),
    );
    controller.abort(new Error("timeout"));
    await expect(pending).rejects.toThrow("timeout");
  });
});
