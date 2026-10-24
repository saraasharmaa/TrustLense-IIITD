import { describe, expect, it } from "vitest";
import { demoToday, findDemoCompanyByGstin, findSnapshot, listDemoCompanies } from "./fixtures";

describe("demo fixtures", () => {
  it("loads the three synthetic companies", () => {
    expect(listDemoCompanies().map((c) => c.key)).toEqual(["aravali", "sunrise", "kaveri"]);
    expect(demoToday).toBe("2026-10-24");
  });

  it("finds a company by GSTIN", () => {
    expect(findDemoCompanyByGstin("33AABCS7345M1Z3")?.key).toBe("sunrise");
    expect(findDemoCompanyByGstin("33AABCS7345M1Z4")).toBeUndefined();
  });

  it("exposes the monitoring change snapshot only for sunrise", () => {
    const withT1 = listDemoCompanies().filter((c) => findSnapshot(c, "t1"));
    expect(withT1.map((c) => c.key)).toEqual(["sunrise"]);
  });
});
