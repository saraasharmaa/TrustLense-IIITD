import type { Finding } from "@/lib/types";
import { CATEGORY_CAPS, groupOf, SCORED_CATEGORIES, type ScoredCategory } from "./rules";

function winnersByGroup(findings: Finding[]): Finding[] {
  const best = new Map<string, Finding>();
  for (const finding of findings) {
    const current = best.get(groupOf(finding.ruleId));
    if (!current || finding.penalty > current.penalty) {
      best.set(groupOf(finding.ruleId), finding);
    }
  }
  return [...best.values()].sort((a, b) => b.penalty - a.penalty);
}

function allocateCategory(findings: Finding[], category: ScoredCategory): Map<Finding, number> {
  const applied = new Map<Finding, number>();
  let remaining = CATEGORY_CAPS[category];
  const candidates = findings.filter((f) => f.category === category && f.penalty > 0);
  for (const winner of winnersByGroup(candidates)) {
    const amount = Math.min(winner.penalty, remaining);
    applied.set(winner, amount);
    remaining -= amount;
  }
  return applied;
}

// Highest penalty per rule group, then the category cap; the largest penalties are kept first
// so a capped category still shows its most serious finding as fully applied.
export function allocatePenalties(findings: Finding[]): Finding[] {
  const applied = new Map<Finding, number>();
  for (const category of SCORED_CATEGORIES) {
    for (const [finding, amount] of allocateCategory(findings, category)) {
      applied.set(finding, amount);
    }
  }
  return findings.map((f) => ({ ...f, appliedPenalty: applied.get(f) ?? 0 }));
}
