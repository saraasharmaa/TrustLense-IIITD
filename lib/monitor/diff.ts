import type { Severity } from "@/lib/types";

const GRADE_RANK = { A: 3, B: 2, C: 1, D: 0 } as const;
type Grade = keyof typeof GRADE_RANK;

export interface SnapshotFinding {
  ruleId: string;
  title: string;
  fingerprint: string;
  severity: Severity;
  hardStop: boolean;
}

export interface CaseSnapshot {
  score: number;
  grade: Grade;
  findings: SnapshotFinding[];
}

export interface ChangeSummary {
  gradeBefore: Grade;
  gradeAfter: Grade;
  scoreBefore: number;
  scoreAfter: number;
  newFindings: { ruleId: string; title: string }[];
  resolvedFindings: { ruleId: string; title: string }[];
  hardStopAppeared: boolean;
}

export type AlertSeverity = "info" | "medium" | "high" | "critical";

export interface CaseDiff {
  severity: AlertSeverity;
  title: string;
  change: ChangeSummary;
}

const SCORE_DELTA_THRESHOLD = 5;

const brief = (f: SnapshotFinding) => ({ ruleId: f.ruleId, title: f.title });

function severityOf(
  change: ChangeSummary,
  added: SnapshotFinding[],
  gradeDrop: number,
): AlertSeverity {
  if (change.hardStopAppeared || gradeDrop >= 2) return "critical";
  if (gradeDrop === 1 || added.some((f) => f.severity === "high" || f.severity === "critical"))
    return "high";
  if (added.length > 0) return "medium";
  return "info";
}

function titleOf(change: ChangeSummary, added: SnapshotFinding[], gradeDrop: number): string {
  const hardStop = added.find((f) => f.hardStop);
  if (hardStop) return hardStop.title;
  if (gradeDrop > 0) return `Grade fell from ${change.gradeBefore} to ${change.gradeAfter}`;
  if (added[0]) return added[0].title;
  return `Risk improved: ${change.gradeBefore} to ${change.gradeAfter}`;
}

// Compares by fingerprint (docs/07 section 6); returns null when nothing worth an alert changed
export function diffCases(before: CaseSnapshot, after: CaseSnapshot): CaseDiff | null {
  const had = new Set(before.findings.map((f) => f.fingerprint));
  const has = new Set(after.findings.map((f) => f.fingerprint));
  const added = after.findings.filter((f) => !had.has(f.fingerprint));
  const resolved = before.findings.filter((f) => !has.has(f.fingerprint));

  const gradeDrop = GRADE_RANK[before.grade] - GRADE_RANK[after.grade];
  const scoreDelta = Math.abs(after.score - before.score);
  const change: ChangeSummary = {
    gradeBefore: before.grade,
    gradeAfter: after.grade,
    scoreBefore: before.score,
    scoreAfter: after.score,
    newFindings: added.map(brief),
    resolvedFindings: resolved.map(brief),
    hardStopAppeared: added.some((f) => f.hardStop),
  };

  const changed =
    gradeDrop !== 0 || scoreDelta >= SCORE_DELTA_THRESHOLD || added.length || resolved.length;
  if (!changed) return null;

  return {
    severity: severityOf(change, added, gradeDrop),
    title: titleOf(change, added, gradeDrop),
    change,
  };
}
