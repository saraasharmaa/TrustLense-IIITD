import { describe, expect, it } from "vitest";
import { CIN_STATES, GST_STATES } from "./states";

describe("state tables", () => {
  it("covers GST codes 01-38 except 28, plus 97 and 99", () => {
    const expected = [
      ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")).filter(
        (code) => code !== "28",
      ),
      "97",
      "99",
    ];
    expect(Object.keys(GST_STATES)).toEqual(expected);
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
