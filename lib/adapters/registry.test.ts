import { describe, expect, it } from "vitest";
import { ADAPTER_ORDER, getAdapter, hasRequiredInputs } from "./registry";

describe("adapter registry", () => {
  it("returns replay adapters in demo mode", async () => {
    const adapter = getAdapter("gst", "demo", { delayMs: [0, 0] });
    const controller = new AbortController();
    const result = await adapter.run(
      { gstin: "08AAGCA4821K1ZM" },
      {
        caseId: "c",
        sourceRunId: "s",
        signal: controller.signal,
        emitProgress: () => {},
        mode: "demo",
        now: new Date(),
      },
    );
    expect(result.isReplay).toBe(true);
  });

  it("skips a source with no live adapter instead of faking it", async () => {
    const result = await getAdapter("udyam", "live").run({}, {} as never);
    expect(result).toMatchObject({ status: "skipped", isReplay: false });
  });

  it("checks required inputs as an OR of ANDs", () => {
    const adapter = {
      ...getAdapter("gst", "demo"),
      requires: [["gstin"], ["cin", "legalName"]] as never,
    };
    expect(hasRequiredInputs(adapter, { gstin: "x" })).toBe(true);
    expect(hasRequiredInputs(adapter, { cin: "x" })).toBe(false);
    expect(hasRequiredInputs(adapter, { cin: "x", legalName: "y" })).toBe(true);
  });

  it("lists all six adapters once", () => {
    expect(new Set(ADAPTER_ORDER).size).toBe(6);
  });
});
