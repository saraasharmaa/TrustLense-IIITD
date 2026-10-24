import { describe, expect, it } from "vitest";
import { legitimacyFindings } from "./legitimacy";
import { outcome, outcomesOf } from "./test-utils";

const GSTIN = "33AABCS7345M1Z3";

function gst(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    legalName: "Sunrise Textiles Pvt Ltd (Demo)",
    tradeName: null,
    gstin: GSTIN,
    registrationStatus: "Active",
    registrationDate: null,
    cancellationDate: null,
    constitution: null,
    taxpayerType: null,
    stateJurisdiction: null,
    centreJurisdiction: null,
    businessActivities: [],
    principalPlace: "12 Mill Road, Tiruppur, Tamil Nadu 641601",
    returns: [],
    ...overrides,
  };
}

function mca(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    cin: "U17111TN2012PTC084430",
    companyName: "SUNRISE TEXTILES PRIVATE LIMITED",
    companyStatus: "Active",
    incorporationDate: null,
    category: null,
    companyClass: null,
    authorizedCapital: null,
    paidUpCapital: null,
    registeredAddress: "12 Mill Road, Tiruppur, Tamil Nadu 641601",
    lastAgmDate: null,
    lastBalanceSheetDate: null,
    directors: [],
    charges: null,
    ...overrides,
  };
}

function udyam(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    udyamNumber: "UDYAM-TN-28-0071120",
    enterpriseName: "SUNRISE TEXTILES PRIVATE LIMITED",
    enterpriseType: null,
    majorActivity: null,
    registrationDate: null,
    state: null,
    nicCodes: [],
    ...overrides,
  };
}

function run(pages: Record<string, unknown>) {
  const entries = Object.entries(pages).map(([adapter, page]) => {
    const status = (page as { status: string }).status === "not_found" ? "not_found" : "succeeded";
    return [adapter, outcome(page, { status })];
  });
  return legitimacyFindings(outcomesOf(Object.fromEntries(entries)));
}

function ruleIds(pages: Record<string, unknown>) {
  return run(pages).map((f) => f.ruleId);
}

describe("BIZ-01 Udyam not found", () => {
  it("triggers when the Udyam adapter ran and found nothing", () => {
    const [finding] = run({ gst: gst(), udyam: { status: "not_found" } });
    expect(finding).toMatchObject({
      ruleId: "BIZ-01",
      severity: "low",
      penalty: 4,
      fingerprint: `BIZ-01:${GSTIN}`,
    });
    expect(finding?.evidence[0]?.adapter).toBe("udyam");
  });

  it("does not trigger when Udyam found a record or did not run", () => {
    expect(ruleIds({ gst: gst(), udyam: udyam() })).toEqual([]);
    expect(ruleIds({ gst: gst() })).toEqual([]);
  });
});

describe("BIZ-02 name consistency", () => {
  it("accepts the same company written differently", () => {
    expect(
      ruleIds({
        gst: gst(),
        mca: mca(),
        udyam: udyam({ enterpriseName: "SUNRISE TEXTILES PVT LTD" }),
      }),
    ).toEqual([]);
  });

  it("triggers when a source has a different name", () => {
    const findings = run({
      gst: gst(),
      mca: mca({ companyName: "KAVERI AGRO TRADERS PRIVATE LIMITED" }),
    });
    expect(findings[0]).toMatchObject({ ruleId: "BIZ-02", severity: "medium", penalty: 5 });
    expect(findings[0]?.evidence).toHaveLength(2);
  });

  it("compares every other source against the first", () => {
    const pages = {
      gst: gst(),
      mca: mca(),
      udyam: udyam({ enterpriseName: "Sunrise Fabrics Pvt Ltd" }),
    };
    expect(ruleIds(pages)).toEqual(["BIZ-02"]);
  });

  it("needs two names to compare and skips missing ones", () => {
    expect(ruleIds({ gst: gst() })).toEqual([]);
    expect(ruleIds({ gst: gst(), mca: mca({ companyName: null }) })).toEqual([]);
  });

  it("treats a trade-name subset as a match", () => {
    expect(ruleIds({ gst: gst({ legalName: "Sunrise Textiles" }), mca: mca() })).toEqual([]);
  });
});

describe("BIZ-03 address state", () => {
  it("triggers when GST and MCA addresses are in different states", () => {
    const findings = run({
      gst: gst(),
      mca: mca({ registeredAddress: "Plot 4, Jaipur, Rajasthan" }),
    });
    expect(findings[0]).toMatchObject({ ruleId: "BIZ-03", severity: "medium", penalty: 5 });
    expect(findings[0]?.detail).toContain("Tamil Nadu");
    expect(findings[0]?.detail).toContain("Rajasthan");
  });

  it("does not trigger for the same state", () => {
    expect(ruleIds({ gst: gst(), mca: mca() })).toEqual([]);
  });

  it.each([
    ["GST address has no state", { principalPlace: "12 Mill Road, Tiruppur" }, {}],
    ["MCA address has no state", {}, { registeredAddress: "12 Mill Road" }],
    ["MCA address names two states", {}, { registeredAddress: "Near Delhi border, Haryana" }],
    ["GST address missing", { principalPlace: null }, {}],
    ["MCA address missing", {}, { registeredAddress: null }],
  ])("is skipped when %s", (_label, gstOverrides, mcaOverrides) => {
    expect(ruleIds({ gst: gst(gstOverrides), mca: mca(mcaOverrides) })).toEqual([]);
  });
});
