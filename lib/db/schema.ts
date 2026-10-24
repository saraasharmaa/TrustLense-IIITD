import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Evidence, Narrative, ScoreResult } from "@/lib/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const caseStatus = pgEnum("case_status", [
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
]);
export const caseMode = pgEnum("case_mode", ["live", "demo"]);
export const triggeredBy = pgEnum("triggered_by", ["user", "monitor", "simulation"]);
export const sourceStatus = pgEnum("source_status", [
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
export const category = pgEnum("category", [
  "STATUTORY",
  "CORPORATE",
  "LEGAL",
  "ADVERSE",
  "LEGITIMACY",
  "COVERAGE",
]);
export const severity = pgEnum("severity", ["info", "low", "medium", "high", "critical"]);
export const alertSeverity = pgEnum("alert_severity", ["info", "medium", "high", "critical"]);

export const subjects = pgTable(
  "subjects",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().default("demo"),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    gstin: text("gstin"),
    pan: text("pan"),
    cin: text("cin"),
    udyamNumber: text("udyam_number"),
    stateCode: text("state_code"),
    entityType: text("entity_type"),
    directors: jsonb("directors").$type<{ din?: string; name: string }[]>(),
    createdAt: createdAt(),
  },
  (t) => [unique("subjects_workspace_gstin").on(t.workspaceId, t.gstin)],
);

export const cases = pgTable(
  "cases",
  {
    id: id(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    status: caseStatus("status").notNull().default("queued"),
    mode: caseMode("mode").notNull(),
    triggeredBy: triggeredBy("triggered_by").notNull().default("user"),
    requestedSources: text("requested_sources").array().notNull(),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    score: integer("score"),
    grade: text("grade"),
    recommendation: text("recommendation"),
    coverage: numeric("coverage", { precision: 4, scale: 3 }),
    isProvisional: boolean("is_provisional"),
    rulesVersion: text("rules_version"),
    // Full result kept so the API can return hard stops and the category breakdown
    scoreResult: jsonb("score_result").$type<ScoreResult>(),
    narrative: jsonb("narrative").$type<Narrative>(),
    parentCaseId: uuid("parent_case_id"),
    createdAt: createdAt(),
  },
  (t) => [index("cases_subject_created").on(t.subjectId, t.createdAt.desc())],
);

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: id(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    adapter: text("adapter").notNull(),
    status: sourceStatus("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(1),
    isReplay: boolean("is_replay").notNull().default(false),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    durationMs: integer("duration_ms"),
    tinyfishRunId: text("tinyfish_run_id"),
    steps: jsonb("steps").$type<{ t: string; text: string; url?: string }[]>(),
    rawOutput: jsonb("raw_output"),
    normalized: jsonb("normalized"),
    error: text("error"),
    credits: numeric("credits"),
    createdAt: createdAt(),
  },
  (t) => [index("source_runs_case").on(t.caseId)],
);

export const findings = pgTable(
  "findings",
  {
    id: id(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    sourceRunId: uuid("source_run_id").references(() => sourceRuns.id),
    ruleId: text("rule_id").notNull(),
    category: category("category").notNull(),
    severity: severity("severity").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    penalty: integer("penalty").notNull(),
    appliedPenalty: integer("applied_penalty").notNull(),
    hardStop: boolean("hard_stop").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
    fingerprint: text("fingerprint").notNull(),
    evidence: jsonb("evidence").$type<Evidence[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("findings_case").on(t.caseId)],
);

export const caseEvents = pgTable(
  "case_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("case_events_case_seq").on(t.caseId, t.seq),
    index("case_events_idx").on(t.caseId, t.seq),
  ],
);

export const watches = pgTable(
  "watches",
  {
    id: id(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    frequencyHours: integer("frequency_hours").notNull(),
    adapters: text("adapters")
      .array()
      .notNull()
      .default(sql`ARRAY['gst','news']::text[]`),
    active: boolean("active").notNull().default(true),
    baselineCaseId: uuid("baseline_case_id").references(() => cases.id),
    lastCaseId: uuid("last_case_id").references(() => cases.id),
    lastRunAt: ts("last_run_at"),
    nextRunAt: ts("next_run_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("watches_next_run")
      .on(t.nextRunAt)
      .where(sql`${t.active}`),
    uniqueIndex("watches_one_active_per_subject")
      .on(t.subjectId)
      .where(sql`${t.active}`),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    previousCaseId: uuid("previous_case_id")
      .notNull()
      .references(() => cases.id),
    severity: alertSeverity("severity").notNull(),
    title: text("title").notNull(),
    change: jsonb("change")
      .$type<{
        gradeBefore: string;
        gradeAfter: string;
        scoreBefore: number;
        scoreAfter: number;
        newFindings: { ruleId: string; title: string }[];
        resolvedFindings: { ruleId: string; title: string }[];
        hardStopAppeared: boolean;
      }>()
      .notNull(),
    isSimulated: boolean("is_simulated").notNull().default(false),
    acknowledgedAt: ts("acknowledged_at"),
    createdAt: createdAt(),
  },
  (t) => [index("alerts_unread").on(t.acknowledgedAt, t.createdAt.desc())],
);

export const sourceCache = pgTable("source_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  ttlSeconds: integer("ttl_seconds").notNull(),
});
