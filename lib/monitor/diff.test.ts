import { describe, expect, it } from "vitest";
import { diffCases, type CaseSnapshot, type SnapshotFinding } from "./diff";

const f = (ruleId: string, extra: Partial<SnapshotFinding> = {}): SnapshotFinding => ({
  ruleId,
  title: `${ruleId} title`,
  fingerprint: `${ruleId}:x`,
  severity: "medium",
  hardStop: false,
  ...extra,
});

const snap = (
  grade: CaseSnapshot["grade"],
  score: number,
  findings: SnapshotFinding[] = [],
): CaseSnapshot => ({
  grade,
  score,
  findings,
});

describe("diffCases", () => {
  it("returns null when nothing changed", () => {
    expect(diffCases(snap("C", 66, [f("GST-03")]), snap("C", 66, [f("GST-03")]))).toBeNull();
  });

  it("AC-10: a suspended GST registration is critical, titled by the hard stop, with the grade move", () => {
    const suspended = f("GST-01", {
      title: "GST registration suspended",
      severity: "critical",
      hardStop: true,
    });
    const diff = diffCases(snap("C", 66, [f("GST-03")]), snap("D", 38, [suspended, f("GST-03")]));
    expect(diff).toMatchObject({
      severity: "critical",
      title: "GST registration suspended",
      change: {
        gradeBefore: "C",
        gradeAfter: "D",
        scoreBefore: 66,
        scoreAfter: 38,
        hardStopAppeared: true,
      },
    });
    expect(diff?.change.newFindings).toEqual([
      { ruleId: "GST-01", title: "GST registration suspended" },
    ]);
  });

  it("maps a two-band drop to critical and a one-band drop to high", () => {
    expect(diffCases(snap("A", 90), snap("C", 60))?.severity).toBe("critical");
    expect(diffCases(snap("B", 75), snap("C", 60))?.severity).toBe("high");
  });

  it("flags a new high finding as high and other new findings as medium", () => {
    expect(
      diffCases(snap("B", 75), snap("B", 74, [f("NEWS-01", { severity: "high" })]))?.severity,
    ).toBe("high");
    expect(
      diffCases(snap("B", 75), snap("B", 74, [f("LEG-04", { severity: "low" })]))?.severity,
    ).toBe("medium");
  });

  it("reports improvements as info, with resolved findings", () => {
    const diff = diffCases(snap("C", 60, [f("GST-03")]), snap("B", 75));
    expect(diff).toMatchObject({ severity: "info", title: "Risk improved: C to B" });
    expect(diff?.change.resolvedFindings).toEqual([{ ruleId: "GST-03", title: "GST-03 title" }]);
  });

  it("alerts on a score move of 5 or more even with the same grade, but not 4", () => {
    expect(diffCases(snap("B", 80), snap("B", 75))).not.toBeNull();
    expect(diffCases(snap("B", 80), snap("B", 76))).toBeNull();
  });

  it("treats the same rule on a different case number as a new finding (fingerprints)", () => {
    const before = snap("C", 60, [f("LEG-02", { fingerprint: "LEG-02:CC/1" })]);
    const after = snap("C", 60, [f("LEG-02", { fingerprint: "LEG-02:CC/2" })]);
    const diff = diffCases(before, after);
    expect(diff?.change.newFindings).toHaveLength(1);
    expect(diff?.change.resolvedFindings).toHaveLength(1);
  });
});
