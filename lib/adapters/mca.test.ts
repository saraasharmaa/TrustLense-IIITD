import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcaAdapter } from "./mca";
import { hasRequiredInputs } from "./registry";
import type { AdapterContext } from "./types";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));
vi.mock("@/lib/tinyfish/client", () => ({ runAgent }));

const ctx = (): AdapterContext => ({
  caseId: "c",
  sourceRunId: "s",
  signal: new AbortController().signal,
  emitProgress: vi.fn(),
  mode: "live",
  now: new Date(),
});

const page = {
  status: "ok",
  cin: "U17111TN2012PTC084430",
  companyName: "SUNRISE TEXTILES PRIVATE LIMITED",
  companyStatus: "Active",
  incorporationDate: "2012-03-01",
  category: null,
  companyClass: null,
  authorizedCapital: null,
  paidUpCapital: 500000,
  registeredAddress: "Tiruppur, Tamil Nadu",
  lastAgmDate: null,
  lastBalanceSheetDate: null,
  directors: [{ din: "01234567", name: "Anil Kumar", appointmentDate: null, disqualified: false }],
  charges: null,
};

beforeEach(() => {
  runAgent.mockReset();
});

describe("mcaAdapter", () => {
  it("looks up by CIN when known and returns directors for later use", async () => {
    runAgent.mockResolvedValue({ runId: "r", resultJson: page });
    const result = await mcaAdapter.run({ cin: "U17111TN2012PTC084430" }, ctx());
    expect(result.status).toBe("succeeded");
    expect(runAgent.mock.calls[0]![0].goal).toContain("CIN U17111TN2012PTC084430");
    expect(result.normalized).toMatchObject({ directors: [{ name: "Anil Kumar" }], charges: null });
  });

  it("falls back to a name lookup when only the name is known", async () => {
    runAgent.mockResolvedValue({ runId: "r", resultJson: { status: "not_found" } });
    const result = await mcaAdapter.run({ legalName: "Acme Pvt Ltd" }, ctx());
    expect(result.status).toBe("not_found");
    expect(runAgent.mock.calls[0]![0].goal).toContain('company name "Acme Pvt Ltd"');
  });

  it("is blocked, not empty, when the portal asks for a CAPTCHA", async () => {
    runAgent.mockResolvedValue({ runId: "r", resultJson: { status: "captcha_blocked" } });
    expect((await mcaAdapter.run({ cin: "x" }, ctx())).status).toBe("captcha_blocked");
  });

  it("requires a CIN or a name", () => {
    expect(hasRequiredInputs(mcaAdapter, {})).toBe(false);
    expect(hasRequiredInputs(mcaAdapter, { cin: "x" })).toBe(true);
    expect(hasRequiredInputs(mcaAdapter, { legalName: "x" })).toBe(true);
  });
});
