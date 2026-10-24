import { describe, expect, it } from "vitest";
import { allocatePenalties } from "./penalties";
import { testFinding } from "./test-utils";

function applied(findings: ReturnType<typeof allocatePenalties>): Record<string, number> {
  return Object.fromEntries(findings.map((f) => [f.fingerprint, f.appliedPenalty]));
}

describe("allocatePenalties", () => {
  it("applies only the highest penalty in a rule group", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "GST-02", penalty: 15, fingerprint: "a" }),
      testFinding({ ruleId: "GST-03", penalty: 8, fingerprint: "b" }),
    ]);
    expect(applied(result)).toEqual({ a: 15, b: 0 });
  });

  it("sums different groups within a category", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "GST-03", penalty: 8, fingerprint: "a" }),
      testFinding({ ruleId: "GST-04", penalty: 4, fingerprint: "b" }),
    ]);
    expect(applied(result)).toEqual({ a: 8, b: 4 });
  });

  it("caps a category and gives the cap to the largest penalty first", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "GST-03", penalty: 15, fingerprint: "filing" }),
      testFinding({ ruleId: "GST-01", penalty: 30, fingerprint: "status" }),
    ]);
    expect(applied(result)).toEqual({ filing: 0, status: 30 });
  });

  it("applies the remaining cap to the second group", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "MCA-02", category: "CORPORATE", penalty: 12, fingerprint: "a" }),
      testFinding({ ruleId: "MCA-03", category: "CORPORATE", penalty: 12, fingerprint: "b" }),
    ]);
    expect(applied(result)).toEqual({ a: 12, b: 8 });
  });

  it("keeps the first finding when two in a group tie", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "LEG-02", category: "LEGAL", penalty: 12, fingerprint: "first" }),
      testFinding({ ruleId: "LEG-02", category: "LEGAL", penalty: 12, fingerprint: "second" }),
    ]);
    expect(applied(result)).toEqual({ first: 12, second: 0 });
  });

  it("treats a rule without a group as its own group and ignores zero penalties", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "X-1", penalty: 2, fingerprint: "a" }),
      testFinding({ ruleId: "X-2", penalty: 3, fingerprint: "b" }),
      testFinding({ ruleId: "NEWS-03", category: "ADVERSE", fingerprint: "info" }),
    ]);
    expect(applied(result)).toEqual({ a: 2, b: 3, info: 0 });
  });

  it("leaves coverage findings unpenalised", () => {
    const result = allocatePenalties([
      testFinding({ ruleId: "COVERAGE-GST", category: "COVERAGE", fingerprint: "c" }),
    ]);
    expect(applied(result)).toEqual({ c: 0 });
  });
});
