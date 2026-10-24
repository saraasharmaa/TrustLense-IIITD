import { z } from "zod";

export const AdapterId = z.enum(["gst", "mca", "legal", "udyam", "news", "regulatory"]);
export type AdapterId = z.infer<typeof AdapterId>;

// carried_forward is set by the monitor when a category reuses the previous case's data
export const SourceStatus = z.enum([
  "pending",
  "running",
  "succeeded",
  "not_found",
  "captcha_blocked",
  "failed",
  "timeout",
  "skipped",
  "carried_forward",
]);
export type SourceStatus = z.infer<typeof SourceStatus>;

export const Severity = z.enum(["info", "low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof Severity>;

export const Category = z.enum([
  "STATUTORY",
  "CORPORATE",
  "LEGAL",
  "ADVERSE",
  "LEGITIMACY",
  "COVERAGE",
]);
export type Category = z.infer<typeof Category>;

export const Evidence = z.object({
  sourceRunId: z.string().uuid(),
  adapter: AdapterId,
  url: z.string().url(),
  retrievedAt: z.string().datetime(),
  excerpt: z.string().max(300),
  isReplay: z.boolean().default(false),
});
export type Evidence = z.infer<typeof Evidence>;

export const Finding = z.object({
  id: z.string(),
  ruleId: z.string(),
  category: Category,
  severity: Severity,
  title: z.string(),
  detail: z.string(),
  penalty: z.number().int().min(0),
  appliedPenalty: z.number().int().min(0),
  hardStop: z.boolean(),
  confidence: z.number().min(0).max(1),
  fingerprint: z.string(),
  evidence: z.array(Evidence),
});
export type Finding = z.infer<typeof Finding>;

const CitedText = z.object({ text: z.string(), findingIds: z.array(z.string()) });

// summary is also held to 120 words by the narrative validator, not just this length
export const Narrative = z.object({
  headline: z.string().max(140),
  summary: z.string().max(900),
  keyRisks: z.array(CitedText).max(5),
  strengths: z.array(CitedText).max(3),
  suggestedConditions: z.array(z.string()).max(4),
  questionsForBorrower: z.array(z.string()).max(4),
  source: z.enum(["llm", "template"]),
});
export type Narrative = z.infer<typeof Narrative>;

export const ScoreResult = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.enum(["A", "B", "C", "D"]),
  recommendation: z.string(),
  hardStops: z.array(z.string()),
  coverage: z.number().min(0).max(1),
  isProvisional: z.boolean(),
  categoryBreakdown: z.array(z.object({ category: Category, cap: z.number(), applied: z.number() })),
  rulesVersion: z.string(),
});
export type ScoreResult = z.infer<typeof ScoreResult>;
