import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { gstAdapter } from "./gst";
import type { AdapterContext } from "./types";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));
vi.mock("@/lib/tinyfish/client", () => ({ runAgent }));

const ctx = (signal = new AbortController().signal): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

const okPage = {
  status: "ok",
  legalName: "Acme Pvt Ltd",
  tradeName: null,
  gstin: "33AABCS7345M1Z3",
  registrationStatus: "Active",
  registrationDate: "2018-04-01",
  cancellationDate: null,
  constitution: "Private Limited Company",
  taxpayerType: "Regular",
  stateJurisdiction: null,
  centreJurisdiction: null,
  businessActivities: [],
  principalPlace: null,
  returns: [],
};

beforeEach(() => {
  runAgent.mockReset();
});

describe("gstAdapter", () => {
  it("asks the agent for the GSTIN with the shared safety rules and returns a succeeded result", async () => {
    runAgent.mockResolvedValue({ runId: "r1", resultJson: okPage });
    const result = await gstAdapter.run({ gstin: "33AABCS7345M1Z3" }, ctx());

    expect(result).toMatchObject({ status: "succeeded", tinyfishRunId: "r1", isReplay: false });
    const { goal } = runAgent.mock.calls[0]![0];
    expect(goal).toContain("33AABCS7345M1Z3");
    expect(goal).toContain("Do not attempt to bypass");
  });

  it("maps a page-level not_found and captcha_blocked", async () => {
    runAgent.mockResolvedValueOnce({ runId: "r", resultJson: { status: "not_found" } });
    expect((await gstAdapter.run({ gstin: "x" }, ctx())).status).toBe("not_found");
    runAgent.mockResolvedValueOnce({ runId: "r", resultJson: { status: "captcha_blocked" } });
    expect((await gstAdapter.run({ gstin: "x" }, ctx())).status).toBe("captcha_blocked");
  });

  it("records a SITE_BLOCKED run error as captcha_blocked without retry-worthy failure", async () => {
    runAgent.mockRejectedValueOnce(
      new AppError("upstream_unavailable", "blocked", { tinyfishCode: "SITE_BLOCKED" }),
    );
    expect((await gstAdapter.run({ gstin: "x" }, ctx())).status).toBe("captcha_blocked");
  });

  it("fails with the validation location when the agent returns the wrong shape", async () => {
    runAgent.mockResolvedValue({ runId: "r", resultJson: { status: "ok", legalName: 5 } });
    const result = await gstAdapter.run({ gstin: "x" }, ctx());
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/failed validation/);
    expect(result.normalized).toBeUndefined();
  });

  it("maps a TinyFish timeout and plain errors", async () => {
    runAgent.mockRejectedValueOnce(
      new AppError("upstream_unavailable", "slow", { tinyfishCode: "TIMEOUT" }),
    );
    expect((await gstAdapter.run({ gstin: "x" }, ctx())).status).toBe("timeout");
    runAgent.mockRejectedValueOnce(new Error("HTTP 500"));
    expect((await gstAdapter.run({ gstin: "x" }, ctx())).status).toBe("failed");
  });

  it("rethrows when the adapter was aborted so the wrapper reports the timeout", async () => {
    const controller = new AbortController();
    controller.abort(new Error("case cap"));
    runAgent.mockRejectedValueOnce(new Error("aborted"));
    await expect(gstAdapter.run({ gstin: "x" }, ctx(controller.signal))).rejects.toThrow();
  });
});
