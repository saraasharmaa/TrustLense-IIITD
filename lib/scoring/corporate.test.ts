import { describe, expect, it } from "vitest";
import { corporateFindings } from "./corporate";
import { NOW, outcome, outcomesOf } from "./test-utils";

const CIN = "U17111TN2012PTC084430";

function mca(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    cin: CIN,
    companyName: "SUNRISE TEXTILES PRIVATE LIMITED",
    companyStatus: "Active",
    incorporationDate: "2012-04-01",
    category: null,
    companyClass: null,
    authorizedCapital: null,
    paidUpCapital: 5_000_000,
    registeredAddress: null,
    lastAgmDate: "2026-03-30",
    lastBalanceSheetDate: "2026-03-31",
    directors: [],
    charges: null,
    ...overrides,
  };
}

function director(name: string, disqualified: boolean | null, din: string | null = null) {
  return { din, name, appointmentDate: null, disqualified };
}

function run(page: unknown, regulatory?: unknown) {
  return corporateFindings(
    outcomesOf({
      mca: outcome(page),
      ...(regulatory ? { regulatory: outcome(regulatory) } : {}),
    }),
    NOW,
  );
}

function ruleIds(page: unknown, regulatory?: unknown) {
  return run(page, regulatory).map((f) => f.ruleId);
}

describe("MCA-01 company status", () => {
  it.each([
    "Strike Off",
    "Under Liquidation",
    "Amalgamated",
    "Dissolved",
    "Under process of striking off",
  ])("%s is a hard stop", (companyStatus) => {
    expect(run(mca({ companyStatus }))[0]).toMatchObject({
      ruleId: "MCA-01",
      severity: "critical",
      penalty: 20,
      hardStop: true,
      title: "Company not active",
    });
  });

  it.each(["Active", "active", null])("does not trigger for %s", (companyStatus) => {
    expect(ruleIds(mca({ companyStatus }))).toEqual([]);
  });
});

describe("MCA-02 overdue filings", () => {
  const penaltyFor = (overrides: Record<string, unknown>) => run(mca(overrides))[0]?.penalty;

  // NOW is 2026-10-24, so 2023-10-24 is exactly 36 months old and 2024-10-24 exactly 24
  it.each([
    ["2023-10-23", 12],
    ["2023-10-24", 8],
    ["2024-10-23", 8],
    ["2024-10-24", undefined],
    ["2026-03-31", undefined],
  ])("balance sheet dated %s → %s", (lastBalanceSheetDate, penalty) => {
    expect(penaltyFor({ lastBalanceSheetDate })).toBe(penalty);
  });

  // AGM thresholds are 36 months for high and 18 for medium; 2025-04-24 is exactly 18
  it.each([
    ["2023-10-23", 12],
    ["2023-10-24", 8],
    ["2025-04-23", 8],
    ["2025-04-24", undefined],
    ["2026-03-30", undefined],
  ])("AGM dated %s → %s", (lastAgmDate, penalty) => {
    expect(penaltyFor({ lastAgmDate })).toBe(penalty);
  });

  it("ignores null dates instead of penalising them", () => {
    expect(ruleIds(mca({ lastAgmDate: null, lastBalanceSheetDate: null }))).toEqual([]);
  });

  it("uses the worse of the two dates", () => {
    expect(penaltyFor({ lastBalanceSheetDate: "2024-12-01", lastAgmDate: "2022-01-01" })).toBe(12);
  });

  it("labels severity and shows both dates as evidence", () => {
    const [finding] = run(mca({ lastBalanceSheetDate: "2022-03-31" }));
    expect(finding).toMatchObject({ severity: "high", title: "Filings badly overdue" });
    expect(finding?.evidence[0]?.excerpt).toBe(
      "Last balance sheet: 2022-03-31; last AGM: 2026-03-30",
    );
  });
});

describe("MCA-04 paid-up capital", () => {
  it.each([
    [99_999, true],
    [100_000, false],
    [0, true],
    [null, false],
  ])("paid-up %s → triggers %s", (paidUpCapital, triggers) => {
    expect(ruleIds(mca({ paidUpCapital })).includes("MCA-04")).toBe(triggers);
  });

  it("formats capital in Indian digit grouping", () => {
    expect(run(mca({ paidUpCapital: 99_999 }))[0]?.evidence[0]?.excerpt).toBe(
      "Paid-up capital: ₹99,999",
    );
  });
});

describe("MCA-03 disqualified directors", () => {
  const regulatory = (matches: unknown[]) => ({ status: "ok", matches });
  const listed = (
    matchedName: string,
    confidence: number,
    list = "MCA_DISQUALIFIED_DIRECTORS",
  ) => ({
    list,
    matchedName,
    matchType: "director",
    confidence,
    date: null,
    summary: `${matchedName} appears on the list`,
    url: "https://example.invalid/list/1",
  });

  it("flags a director marked disqualified by MCA", () => {
    const [finding] = run(mca({ directors: [director("A Kumar", true, "01234567")] }));
    expect(finding).toMatchObject({
      ruleId: "MCA-03",
      severity: "high",
      penalty: 12,
      fingerprint: "MCA-03:01234567",
    });
  });

  it("does not flag false or unknown director flags", () => {
    expect(ruleIds(mca({ directors: [director("A", false), director("B", null)] }))).toEqual([]);
  });

  it("counts disqualified-list matches at confidence 0.8 or above, not below", () => {
    expect(ruleIds(mca(), regulatory([listed("B Rao", 0.8)]))).toEqual(["MCA-03"]);
    expect(ruleIds(mca(), regulatory([listed("B Rao", 0.79)]))).toEqual([]);
  });

  it("ignores non-director lists here (they feed REG-01)", () => {
    expect(ruleIds(mca(), regulatory([listed("B Rao", 0.95, "SEBI_ORDERS")]))).toEqual([]);
  });

  it("dedupes the same person flagged by MCA and by the list", () => {
    const findings = run(
      mca({ directors: [director("B Rao", true, "00000001")] }),
      regulatory([listed("b rao", 0.9)]),
    );
    expect(findings.map((f) => f.ruleId)).toEqual(["MCA-03"]);
  });

  it("keeps different people as separate findings for the group to count once", () => {
    const findings = run(mca({ directors: [director("A Kumar", true), director("C Das", true)] }));
    expect(findings).toHaveLength(2);
  });

  it("still reports list matches when the MCA page is unusable", () => {
    const findings = corporateFindings(
      outcomesOf({
        mca: outcome({ status: "not_found" }, { status: "not_found" }),
        regulatory: outcome(regulatory([listed("B Rao", 0.9)])),
      }),
      NOW,
    );
    expect(findings.map((f) => f.ruleId)).toEqual(["MCA-03"]);
    expect(findings[0]?.evidence[0]?.adapter).toBe("regulatory");
  });
});

describe("unusable MCA data", () => {
  it.each([{ status: "not_found" }, { status: "captcha_blocked" }])(
    "yields nothing for %j",
    (page) => {
      expect(run(page)).toEqual([]);
    },
  );
});
