import { describe, expect, it } from "vitest";
import { gradeFor, recommendationFor } from "./grades";

describe("gradeFor", () => {
  it.each([
    [100, "A"],
    [85, "A"],
    [84, "B"],
    [70, "B"],
    [69, "C"],
    [50, "C"],
    [49, "D"],
    [0, "D"],
  ] as const)("score %i is grade %s", (score, grade) => {
    expect(gradeFor(score, [])).toBe(grade);
  });

  it("forces D on a hard stop even at a high score", () => {
    expect(gradeFor(97, ["GST registration cancelled"])).toBe("D");
  });
});

describe("recommendationFor", () => {
  it.each([
    ["A", "Proceed with standard checks"],
    ["B", "Proceed with conditions"],
    ["C", "Manual review required"],
    ["D", "Escalate – high risk"],
  ] as const)("grade %s recommends %s", (grade, text) => {
    expect(recommendationFor(grade, [], false)).toBe(text);
  });

  it("lists every hard stop", () => {
    expect(
      recommendationFor("D", ["GST registration cancelled", "Insolvency proceedings"], false),
    ).toBe("Escalate – high risk (hard stop: GST registration cancelled; Insolvency proceedings)");
  });

  it("downgrades A and B to manual review when provisional, but leaves C and D alone", () => {
    expect(recommendationFor("A", [], true)).toBe("Manual review required (limited coverage)");
    expect(recommendationFor("B", [], true)).toBe("Manual review required (limited coverage)");
    expect(recommendationFor("C", [], true)).toBe("Manual review required");
    expect(recommendationFor("D", [], true)).toBe("Escalate – high risk");
  });

  it("keeps the hard-stop wording when provisional", () => {
    expect(recommendationFor("D", ["Company not active"], true)).toBe(
      "Escalate – high risk (hard stop: Company not active)",
    );
  });
});
