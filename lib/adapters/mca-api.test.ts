import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcaApiAdapter } from "./mca-api";
import type { AdapterContext } from "./types";

const fetchCompanyMasterData = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sandbox/client", () => ({ fetchCompanyMasterData }));

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

beforeEach(() => {
  fetchCompanyMasterData.mockReset();
});

describe("mcaApiAdapter", () => {
  it("maps master data and labels the provider, with no invented directors or filing dates", async () => {
    fetchCompanyMasterData.mockResolvedValue({
      cin: "L17110MH1973PLC019786",
      company_name: "RELIANCE INDUSTRIES LIMITED",
      company_status: "Active",
      company_category: "Company limited by shares",
      company_class: "Public",
      authorized_capital: 1000,
      paidup_capital: 900,
      company_registration_date: "1973-05-08",
      registered_office_address: "Mumbai",
    });
    const result = await mcaApiAdapter.run({ cin: "L17110MH1973PLC019786" }, ctx());
    expect(result.status).toBe("succeeded");
    expect(result.normalized).toMatchObject({
      companyStatus: "Active",
      paidUpCapital: 900,
      directors: [],
      lastAgmDate: null,
      charges: null,
    });
    expect(result.rawOutput).toMatchObject({ provider: "sandbox.co.in" });
  });

  it("reports not_found for an unknown CIN", async () => {
    fetchCompanyMasterData.mockResolvedValue(null);
    expect((await mcaApiAdapter.run({ cin: "L17110MH1973PLC019786" }, ctx())).status).toBe(
      "not_found",
    );
  });

  it("reports failed with the reason when the API errors", async () => {
    fetchCompanyMasterData.mockRejectedValue(
      new Error("Sandbox returned HTTP 402: insufficient balance"),
    );
    const result = await mcaApiAdapter.run({ cin: "L17110MH1973PLC019786" }, ctx());
    expect(result).toMatchObject({ status: "failed" });
    expect(result.error).toContain("402");
  });
});
