import { describe, expect, it } from "vitest";
import { validateGstin } from "./gstin";

describe("validateGstin format and state", () => {
  it("normalises case and whitespace", () => {
    expect(validateGstin("  33aabcs7345m1z3 ")).toMatchObject({
      ok: true,
      value: { gstin: "33AABCS7345M1Z3", stateCode: "33", stateName: "Tamil Nadu" },
    });
  });

  it.each([
    "",
    "33AABCS7345M1Z",
    "33AABCS7345M1Z33",
    "33AABCS7345M1X3",
    "33AABCS7345M0Z3",
    "33AABCS734XM1Z3",
    "4 3AABCS7345M1Z3",
    "43AABCS7345M1Z3",
  ])("rejects %j on format", (input) => {
    expect(validateGstin(input)).toMatchObject({ ok: false, check: "format" });
  });

  it.each(["00", "28", "39"])("rejects state code %s", (code) => {
    expect(validateGstin(`${code}AABCS7345M1Z3`)).toMatchObject({ ok: false, check: "state" });
  });
});

describe("validateGstin checksum", () => {
  it.each(["08AAGCA4821K1ZM", "33AABCS7345M1Z3", "29AAECK9012P1ZZ", "27AAPFU0939F1ZV"])(
    "accepts %s",
    (gstin) => {
      expect(validateGstin(gstin)).toMatchObject({ ok: true });
    },
  );

  it("AC-1: rejects a valid GSTIN with its last character changed", () => {
    expect(validateGstin("33AABCS7345M1Z4")).toEqual({
      ok: false,
      check: "checksum",
      message: "GSTIN checksum is invalid",
    });
  });
});

describe("validateGstin derivation", () => {
  it("AC-1: derives PAN, state and entity type", () => {
    expect(validateGstin("33AABCS7345M1Z3")).toEqual({
      ok: true,
      value: {
        gstin: "33AABCS7345M1Z3",
        pan: "AABCS7345M",
        stateCode: "33",
        stateName: "Tamil Nadu",
        entityType: "Company",
      },
    });
  });

  it.each([
    ["08AAGCA4821K1ZM", "AAGCA4821K", "Rajasthan"],
    ["29AAECK9012P1ZZ", "AAECK9012P", "Karnataka"],
  ])("derives the fixture subject %s", (gstin, pan, stateName) => {
    expect(validateGstin(gstin)).toMatchObject({ ok: true, value: { pan, stateName } });
  });

  it("derives a firm from PAN type F", () => {
    expect(validateGstin("27AAPFU0939F1ZV")).toMatchObject({
      ok: true,
      value: { entityType: "Firm/LLP" },
    });
  });
});
