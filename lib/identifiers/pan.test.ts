import { describe, expect, it } from "vitest";
import { validatePan } from "./pan";

describe("validatePan", () => {
  it("accepts a company PAN and derives its entity type", () => {
    expect(validatePan("AABCS7345M")).toEqual({
      ok: true,
      value: { pan: "AABCS7345M", entityType: "Company" },
    });
  });

  it("trims and uppercases before checking", () => {
    expect(validatePan("  aabcs7345m ")).toMatchObject({ ok: true });
  });

  it.each([
    ["F", "Firm/LLP"],
    ["P", "Individual"],
    ["H", "HUF"],
    ["A", "AOP"],
    ["T", "Trust"],
    ["B", "BOI"],
    ["L", "Local Authority"],
    ["J", "Artificial Juridical Person"],
    ["G", "Government"],
  ])("maps 4th character %s to %s", (letter, entityType) => {
    expect(validatePan(`AAA${letter}A1234A`)).toMatchObject({ ok: true, value: { entityType } });
  });

  it("rejects an unknown 4th character", () => {
    expect(validatePan("AAAZA1234A")).toMatchObject({ ok: false, check: "format" });
  });

  it.each(["", "AABCS7345", "AABCS73450", "1ABCS7345M", "AABCS7345MM"])(
    "rejects malformed input %j",
    (input) => {
      expect(validatePan(input)).toMatchObject({ ok: false, check: "format" });
    },
  );
});
