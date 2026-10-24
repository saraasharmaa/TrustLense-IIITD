import type { ScoreResult } from "@/lib/types";

export type Grade = ScoreResult["grade"];

export function gradeFor(score: number, hardStops: string[]): Grade {
  if (hardStops.length > 0) return "D";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

// Wording comes from docs/07 section 4; the UI shows these strings as they are
export function recommendationFor(
  grade: Grade,
  hardStops: string[],
  isProvisional: boolean,
): string {
  if (hardStops.length > 0) return `Escalate – high risk (hard stop: ${hardStops.join("; ")})`;
  if (isProvisional && (grade === "A" || grade === "B")) {
    return "Manual review required (limited coverage)";
  }
  if (grade === "A") return "Proceed with standard checks";
  if (grade === "B") return "Proceed with conditions";
  if (grade === "C") return "Manual review required";
  return "Escalate – high risk";
}
