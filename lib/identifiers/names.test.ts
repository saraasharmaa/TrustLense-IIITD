import { describe, expect, it } from "vitest";
import { nameSimilarity, nameTokens } from "./names";

describe("nameTokens", () => {
  it("lowercases, drops parentheticals, expands abbreviations and strips punctuation", () => {
    expect([...nameTokens("Sunrise Textiles Pvt. Ltd. (Demo)")].sort()).toEqual([
      "limited",
      "private",
      "sunrise",
      "textiles",
    ]);
  });
});

describe("nameSimilarity", () => {
  it.each([
    ["Aravali Precision Components Pvt Ltd (Demo)", "ARAVALI PRECISION COMPONENTS PRIVATE LIMITED"],
    ["ARAVALI PRECISION COMPONENTS PRIVATE LIMITED", "ARAVALI PRECISION COMPONENTS PVT LTD"],
    ["Sunrise Textiles Pvt Ltd (Demo)", "SUNRISE TEXTILES PRIVATE LIMITED"],
    ["Kaveri Agro Traders Pvt Ltd (Demo)", "KAVERI AGRO TRADERS PRIVATE LIMITED"],
  ])("fixture names %j and %j match fully", (a, b) => {
    expect(nameSimilarity(a, b)).toBe(1);
  });

  it("treats a token subset as a full match", () => {
    expect(nameSimilarity("Sunrise Textiles", "Sunrise Textiles Private Limited")).toBe(1);
  });

  it("uses Dice overlap when neither name contains the other", () => {
    expect(nameSimilarity("Sunrise Textiles Pvt Ltd", "Sunrise Fabrics Pvt Ltd")).toBe(0.75);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Sunrise Textiles Pvt Ltd", "Kaveri Agro Traders Pvt Ltd")).toBeLessThan(
      0.85,
    );
  });

  it("is symmetric", () => {
    const a = "Sunrise Textiles Pvt Ltd";
    const b = "Sunrise Fabrics Pvt Ltd";
    expect(nameSimilarity(a, b)).toBe(nameSimilarity(b, a));
  });

  it("does not treat a missing name as a mismatch", () => {
    expect(nameSimilarity("", "Sunrise Textiles")).toBe(1);
    expect(nameSimilarity("(Demo)", "Sunrise Textiles")).toBe(1);
  });
});
