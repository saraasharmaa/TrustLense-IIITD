import { describe, expect, it } from "vitest";
import { monthsBetween } from "./dates";

const now = new Date("2026-10-24");

describe("monthsBetween", () => {
  it("counts whole months", () => {
    expect(monthsBetween("2025-10-24", now)).toBe(12);
    expect(monthsBetween("2023-10-24", now)).toBe(36);
  });

  it("adds the day difference as a fraction of 31", () => {
    expect(monthsBetween("2025-10-14", now)).toBeCloseTo(12 + 10 / 31, 5);
    expect(monthsBetween("2025-10-31", now)).toBeCloseTo(12 - 7 / 31, 5);
  });

  it("goes negative for a future date", () => {
    expect(monthsBetween("2026-12-24", now)).toBe(-2);
  });
});
