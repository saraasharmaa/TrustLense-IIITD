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
