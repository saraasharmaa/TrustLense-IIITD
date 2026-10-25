import { beforeEach, describe, expect, it, vi } from "vitest";
import { gstApiAdapter } from "./gst-api";
import type { AdapterContext } from "./types";

const mocks = vi.hoisted(() => ({ fetchProfile: vi.fn(), fetchReturns: vi.fn() }));
vi.mock("@/lib/gstinapi/client", () => {
  class GstApiError extends Error {
    constructor(
      readonly httpStatus: number,
      message: string,
    ) {
      super(message);
    }
  }
  return { fetchProfile: mocks.fetchProfile, fetchReturns: mocks.fetchReturns, GstApiError };
});

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date("2026-10-24"),
});

const profile = (frequency: "Monthly" | "Quarterly" | null) => ({
  profile: {
    legal_name: "ACME PRIVATE LIMITED",
    trade_name: null,
    registration_date: "2018-04-01",
    business_constitution: "Private Limited Company",
    status: "Active",
    taxpayer_type: "Regular",
    address: "Pune, Maharashtra",
    filing_frequency: frequency,
  },
  unavailable: [] as string[],
});

const filed = (period: string) => ({
  return_type: "GSTR-3B",
  return_period: period,
  filing_status: "Filed",
  filing_date: `${period}-18`,
});

beforeEach(() => {
  mocks.fetchProfile.mockReset();
  mocks.fetchReturns.mockReset();
});

describe("gstApiAdapter", () => {
  it("maps the profile and marks periods with no filed return as not filed for monthly filers", async () => {
    mocks.fetchProfile.mockResolvedValue(profile("Monthly"));
    mocks.fetchReturns.mockResolvedValue([
      filed("2026-09"),
      filed("2026-08"),
      { ...filed("2026-07"), return_type: "GSTR-1" },
    ]);
    const result = await gstApiAdapter.run({ gstin: "27AAACR5055K1Z7" }, ctx());

    expect(result.status).toBe("succeeded");
    const data = result.normalized as {
      registrationStatus: string;
      returns: { period: string; status: string }[];
    };
    expect(data.registrationStatus).toBe("Active");
    expect(data.returns).toHaveLength(12);
    expect(data.returns[0]).toMatchObject({ period: "2026-09", status: "Filed" });
    expect(data.returns[2]).toMatchObject({ period: "2026-07", status: "Not Filed" });
    expect(result.rawOutput).toMatchObject({ provider: "gstinapi.in" });
  });

  it("skips return rules for quarterly filers instead of inventing missed months", async () => {
    mocks.fetchProfile.mockResolvedValue(profile("Quarterly"));
    const result = await gstApiAdapter.run({ gstin: "27AAACR5055K1Z7" }, ctx());
    expect((result.normalized as { returns: unknown[] }).returns).toEqual([]);
    expect(mocks.fetchReturns).not.toHaveBeenCalled();
  });

  it("skips return rules when the filing frequency could not be fetched", async () => {
    mocks.fetchProfile.mockResolvedValue({ ...profile(null), unavailable: ["filing_frequency"] });
    const result = await gstApiAdapter.run({ gstin: "27AAACR5055K1Z7" }, ctx());
    expect((result.normalized as { returns: unknown[] }).returns).toEqual([]);
  });

  it("reports not_found when the GSTIN is not registered, and failed for other API errors", async () => {
    const { GstApiError } = await import("@/lib/gstinapi/client");
    mocks.fetchProfile.mockRejectedValueOnce(new GstApiError(404, "not found"));
    expect((await gstApiAdapter.run({ gstin: "27AAACR5055K1Z7" }, ctx())).status).toBe("not_found");
    mocks.fetchProfile.mockRejectedValueOnce(
      new GstApiError(402, "GSTIN API returned HTTP 402: out of credits"),
    );
    const failed = await gstApiAdapter.run({ gstin: "27AAACR5055K1Z7" }, ctx());
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed.error).toContain("out of credits");
  });
});
