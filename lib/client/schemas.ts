import { z } from "zod";
import { AdapterId, Category, Narrative, Severity, SourceStatus } from "@/lib/types";

export const DemoCompany = z.object({
  key: z.string(),
  legalName: z.string(),
  gstin: z.string(),
  expectedGrade: z.string(),
});
export const DemoCompanies = z.object({ companies: z.array(DemoCompany) });
export const Health = z.object({ ok: z.boolean(), demoMode: z.boolean() });
export const CreatedCase = z.object({ caseId: z.string().uuid() });

const ViewEvidence = z.object({
  url: z.string(),
  retrievedAt: z.string(),
  excerpt: z.string(),
  adapter: AdapterId,
  isReplay: z.boolean(),
});

export const ViewFinding = z.object({
  id: z.string(),
  ruleId: z.string(),
  category: Category,
  severity: Severity,
  title: z.string(),
  detail: z.string(),
  appliedPenalty: z.number(),
  hardStop: z.boolean(),
  confidence: z.number(),
  evidence: z.array(ViewEvidence),
});

const ViewRun = z.object({
  id: z.string(),
  adapter: AdapterId,
  status: SourceStatus,
  isReplay: z.boolean(),
  isManual: z.boolean(),
  durationMs: z.number().nullable(),
  attempt: z.number(),
  error: z.string().nullable(),
});

export const CaseView = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "completed", "partial", "failed"]),
  mode: z.enum(["live", "demo"]),
  subject: z.object({
    legalName: z.string(),
    gstin: z.string().nullable(),
    pan: z.string().nullable(),
    cin: z.string().nullable(),
    stateCode: z.string().nullable(),
    entityType: z.string().nullable(),
  }),
  score: z.number().nullable(),
  grade: z.enum(["A", "B", "C", "D"]).nullable(),
  recommendation: z.string().nullable(),
  coverage: z.number().nullable(),
  isProvisional: z.boolean().nullable(),
  hardStops: z.array(z.string()),
  categoryBreakdown: z.array(
    z.object({ category: Category, cap: z.number(), applied: z.number() }),
  ),
  narrative: Narrative.nullable(),
  sourceRuns: z.array(ViewRun),
  findings: z.array(ViewFinding),
  completedAt: z.string().nullable(),
  watch: z.object({ id: z.string(), frequencyHours: z.number(), active: z.boolean() }).nullable(),
});
export type CaseView = z.infer<typeof CaseView>;
export type ViewFinding = z.infer<typeof ViewFinding>;

const Change = z.object({
  gradeBefore: z.string(),
  gradeAfter: z.string(),
  scoreBefore: z.number(),
  scoreAfter: z.number(),
  newFindings: z.array(z.object({ ruleId: z.string(), title: z.string() })),
  resolvedFindings: z.array(z.object({ ruleId: z.string(), title: z.string() })),
  hardStopAppeared: z.boolean(),
});

export const AlertItem = z.object({
  id: z.string(),
  severity: z.enum(["info", "medium", "high", "critical"]),
  title: z.string(),
  isSimulated: z.boolean(),
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  subject: z.object({ id: z.string(), legalName: z.string(), gstin: z.string().nullable() }),
  change: Change,
  caseId: z.string(),
  previousCaseId: z.string(),
});
export const Alerts = z.object({ unreadCount: z.number(), alerts: z.array(AlertItem) });
export type AlertItem = z.infer<typeof AlertItem>;

export const WatchItem = z.object({
  id: z.string(),
  subject: z.object({ id: z.string(), legalName: z.string(), gstin: z.string().nullable() }),
  frequencyHours: z.number(),
  active: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  currentGrade: z.string().nullable(),
  baselineGrade: z.string().nullable(),
});
export const Watches = z.object({ watches: z.array(WatchItem) });
export type WatchItem = z.infer<typeof WatchItem>;

export const RecentCases = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      mode: z.enum(["live", "demo"]),
      score: z.number().nullable(),
      grade: z.string().nullable(),
      createdAt: z.string(),
      subject: z.object({ legalName: z.string(), gstin: z.string().nullable() }),
    }),
  ),
});

export const SimulatedChange = z.object({ caseId: z.string(), alertId: z.string() });
export const Watched = z.object({ watchId: z.string() });
