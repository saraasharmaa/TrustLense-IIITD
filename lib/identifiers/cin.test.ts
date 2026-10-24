import { describe, expect, it } from "vitest";
import { validateCin } from "./cin";

describe("validateCin", () => {
  it("derives listing status, state and incorporation year", () => {
    expect(validateCin("U17111TN2012PTC084430")).toEqual({
      ok: true,
      value: {
        cin: "U17111TN2012PTC084430",
        listingStatus: "Unlisted",
        stateName: "Tamil Nadu",
        incorporationYear: 2012,
      },
    });
  });

  it("marks a CIN starting with L as listed", () => {
    expect(validateCin("L17110MH1973PLC019786")).toMatchObject({
      ok: true,
      value: { listingStatus: "Listed", stateName: "Maharashtra" },
    });
  });

  it.each(["U28999RJ2016PTC049871", "U51909KA2018PTC112245"])("accepts fixture CIN %s", (cin) => {
    expect(validateCin(cin)).toMatchObject({ ok: true });
  });

  it("normalises case and whitespace", () => {
    expect(validateCin(" u17111tn2012ptc084430 ")).toMatchObject({ ok: true });
  });

  it("keeps a format-valid CIN with unknown state letters, without a state name", () => {
    expect(validateCin("U17111XX2012PTC084430")).toMatchObject({
      ok: true,
      value: { stateName: null },
    });
  });

  it.each([
    "",
    "X17111TN2012PTC084430",
    "U1711TN2012PTC084430",
    "U17111TN201PTC084430",
    "U17111TN2012PT084430",
    "U17111TN2012PTC08443",
    "U17111TN2012PTC0844300",
  ])("rejects malformed input %j", (input) => {
    expect(validateCin(input)).toMatchObject({ ok: false, check: "format" });
  });
});
