import { describe, expect, it } from "vitest";
import { CIN_STATES, GST_STATES, stateNameInText } from "./states";

describe("state tables", () => {
  it("covers GST codes 01-38 except 28, plus 97 and 99", () => {
    const expected = [
      ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")).filter(
        (code) => code !== "28",
      ),
      "97",
      "99",
    ];
    expect(Object.keys(GST_STATES).sort()).toEqual(expected);
  });

  it("names the fixture states", () => {
    expect(GST_STATES["33"]).toBe("Tamil Nadu");
    expect(GST_STATES["08"]).toBe("Rajasthan");
    expect(GST_STATES["29"]).toBe("Karnataka");
    expect(CIN_STATES.TN).toBe("Tamil Nadu");
    expect(CIN_STATES.RJ).toBe("Rajasthan");
    expect(CIN_STATES.KA).toBe("Karnataka");
  });
});

describe("stateNameInText", () => {
  it("finds the state named in an address, case-insensitively", () => {
    expect(stateNameInText("12 Mill Road, Tiruppur, TAMIL NADU 641601")).toBe("Tamil Nadu");
    expect(stateNameInText("Plot 4, Sector 8, Jaipur, Rajasthan")).toBe("Rajasthan");
  });

  it("finds multi-word states across extra whitespace", () => {
    expect(stateNameInText("Lucknow, Uttar   Pradesh")).toBe("Uttar Pradesh");
  });

  it("returns null when no state or more than one state is named", () => {
    expect(stateNameInText("12 Mill Road, Tiruppur")).toBeNull();
    expect(stateNameInText("Near Delhi border, Haryana")).toBeNull();
  });

  it("does not match a state inside a longer word", () => {
    expect(stateNameInText("Goann Street")).toBeNull();
  });
});
