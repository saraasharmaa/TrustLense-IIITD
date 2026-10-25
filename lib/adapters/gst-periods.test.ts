import { describe, expect, it } from "vitest";
import { dueGstr3bPeriods, financialYearOf } from "./gst-periods";

describe("dueGstr3bPeriods", () => {
  it("on or after the 20th, last month's return is due", () => {
    expect(dueGstr3bPeriods(new Date("2026-10-24"), 3)).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(dueGstr3bPeriods(new Date("2026-10-20"), 1)).toEqual(["2026-09"]);
  });

  it("before the 20th, last month's return is not due yet", () => {
    expect(dueGstr3bPeriods(new Date("2026-10-19"), 2)).toEqual(["2026-08", "2026-07"]);
  });

  it("crosses year boundaries", () => {
    expect(dueGstr3bPeriods(new Date("2026-02-10"), 3)).toEqual(["2025-12", "2025-11", "2025-10"]);
    expect(dueGstr3bPeriods(new Date("2026-01-25"), 2)).toEqual(["2025-12", "2025-11"]);
  });

  it("returns twelve distinct periods", () => {
    expect(new Set(dueGstr3bPeriods(new Date("2026-10-24"), 12)).size).toBe(12);
  });
});

describe("financialYearOf", () => {
  it("runs April to March", () => {
    expect(financialYearOf("2026-03")).toBe("2025-26");
    expect(financialYearOf("2026-04")).toBe("2026-27");
    expect(financialYearOf("2099-12")).toBe("2099-00");
  });
});
