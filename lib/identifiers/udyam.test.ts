import { describe, expect, it } from "vitest";
import { validateUdyam } from "./udyam";

describe("validateUdyam", () => {
  it("accepts a fixture number and exposes its state letters", () => {
    expect(validateUdyam("UDYAM-TN-28-0071120")).toEqual({
      ok: true,
      value: { udyamNumber: "UDYAM-TN-28-0071120", stateLetters: "TN" },
    });
  });

  it("normalises case and whitespace", () => {
    expect(validateUdyam(" udyam-rj-17-0034512 ")).toMatchObject({ ok: true });
  });

  it.each([
    "",
    "UDYAM-TN-28-007112",
    "UDYAM-TN-28-00711200",
    "UDYAM-T-28-0071120",
    "UDYAM-TN-2-0071120",
    "UDYAM-TN-28-007112O",
    "UDYAM TN 28 0071120",
    "TN-28-0071120",
  ])("rejects %j", (input) => {
    expect(validateUdyam(input)).toMatchObject({ ok: false, check: "format" });
  });
});
