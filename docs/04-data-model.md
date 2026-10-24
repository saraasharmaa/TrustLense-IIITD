# 04 — Data Model and Shared Types

Implement with Drizzle (`lib/db/schema.ts`). All tables have `id uuid pk default gen_random_uuid()` unless noted, and `created_at timestamptz default now()`. Single demo workspace: `workspace_id text default 'demo'` on tenant tables (future multi-tenancy).

## Tables

### subjects
| col | type | notes |
|---|---|---|
| workspace_id | text | default 'demo' |
| legal_name | text | required |
| trade_name | text | nullable |
| gstin | text | nullable; unique per workspace when present |
| pan | text | derived from GSTIN |
| cin | text | nullable |
| udyam_number | text | nullable |
| state_code | text | 2-digit GST state code |
| entity_type | text | Company / Firm / etc. |
| directors | jsonb | `[{din?, name}]` discovered via MCA; used for disambiguation |

### cases
| col | type | notes |
|---|---|---|
| subject_id | uuid fk | |
| status | enum | `queued, running, completed, partial, failed` |
| mode | enum | `live, demo` |
| triggered_by | enum | `user, monitor, simulation` |
| requested_sources | text[] | adapter ids |
| started_at / completed_at | timestamptz | |
| score | int | null until computed |
| grade | text | A–D |
| recommendation | text | |
| coverage | numeric(4,3) | 0–1 |
| is_provisional | boolean | |
| rules_version | text | e.g. `1.0.0` |
| narrative | jsonb | see Narrative type |
| parent_case_id | uuid | for rerun chains |
| version | int | report version, increments on rerun |

### source_runs
| col | type | notes |
|---|---|---|
| case_id | uuid fk | |
| adapter | text | `gst, mca, legal, udyam, news, regulatory` |
| status | enum | `pending, running, succeeded, not_found, captcha_blocked, failed, timeout, skipped` |
| attempt | int | |
| is_replay | boolean | fixture/replay data |
| started_at / finished_at | timestamptz | |
| duration_ms | int | |
| tinyfish_run_id | text | |
| steps | jsonb | condensed progress `[ {t, text, url?} ]` (cap 50) |
| raw_output | jsonb | untouched TinyFish output |
| normalized | jsonb | zod-validated adapter output |
| error | text | message, no secrets |
| credits | numeric | if TinyFish reports usage |

### findings
| col | type | notes |
|---|---|---|
| case_id | uuid fk | |
| source_run_id | uuid fk nullable | |
| rule_id | text | e.g. `GST-02` |
| category | enum | `STATUTORY, CORPORATE, LEGAL, ADVERSE, LEGITIMACY, COVERAGE` |
| severity | enum | `info, low, medium, high, critical` |
| title | text | |
| detail | text | |
| penalty | int | points applied (after group/cap logic: store raw and `applied_penalty`) |
| applied_penalty | int | |
| hard_stop | boolean | |
| confidence | numeric(3,2) | |
| fingerprint | text | stable key for diffing, e.g. `GST-01:<gstin>` or `LEG-02:<caseNumber>` |
| evidence | jsonb | `Evidence[]` |

### case_events
`id bigserial pk`, `case_id uuid`, `seq int`, `type text`, `data jsonb`, `ts timestamptz`; **unique(case_id, seq)**; index (case_id, seq).

### watches
| col | type | notes |
|---|---|---|
| subject_id | uuid fk | unique active per subject |
| frequency_hours | int | 6, 24, 168 |
| adapters | text[] | default `['gst','news']` (+ `legal`) |
| active | boolean | |
| baseline_case_id | uuid | case at time of watching |
| last_case_id | uuid | most recent monitored case |
| last_run_at / next_run_at | timestamptz | indexed on next_run_at |

### alerts
| col | type | notes |
|---|---|---|
| watch_id | uuid fk | |
| subject_id | uuid fk | |
| case_id | uuid fk | the new case |
| previous_case_id | uuid fk | |
| severity | enum | `info, medium, high, critical` |
| title | text | e.g. "GST registration suspended" |
| change | jsonb | `{gradeBefore, gradeAfter, scoreBefore, scoreAfter, newFindings[], resolvedFindings[], hardStopAppeared}` |
| is_simulated | boolean | |
| acknowledged_at | timestamptz | null = unread |

### source_cache
`key text pk` (`adapter:identifier`), `payload jsonb`, `fetched_at`, `ttl_seconds`.

## Shared TypeScript / zod types (`lib/types.ts`)

```ts
export const AdapterId = z.enum(['gst','mca','legal','udyam','news','regulatory']);
export const SourceStatus = z.enum(['pending','running','succeeded','not_found','captcha_blocked','failed','timeout','skipped']);
export const Severity = z.enum(['info','low','medium','high','critical']);
export const Category = z.enum(['STATUTORY','CORPORATE','LEGAL','ADVERSE','LEGITIMACY','COVERAGE']);

export const Evidence = z.object({
  sourceRunId: z.string().uuid(),
  adapter: AdapterId,
  url: z.string().url(),
  retrievedAt: z.string().datetime(),
  excerpt: z.string().max(300),
  isReplay: z.boolean().default(false),
});

export const Finding = z.object({
  id: z.string(), ruleId: z.string(), category: Category, severity: Severity,
  title: z.string(), detail: z.string(),
  penalty: z.number().int().min(0), appliedPenalty: z.number().int().min(0),
  hardStop: z.boolean(), confidence: z.number().min(0).max(1),
  fingerprint: z.string(), evidence: z.array(Evidence),
});

export const Narrative = z.object({
  headline: z.string().max(140),
  summary: z.string().max(900),
  keyRisks: z.array(z.object({ text: z.string(), findingIds: z.array(z.string()) })).max(5),
  strengths: z.array(z.object({ text: z.string(), findingIds: z.array(z.string()) })).max(3),
  suggestedConditions: z.array(z.string()).max(4),
  questionsForBorrower: z.array(z.string()).max(4),
  source: z.enum(['llm','template']),
});

export const ScoreResult = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.enum(['A','B','C','D']),
  recommendation: z.string(),
  hardStops: z.array(z.string()),
  coverage: z.number().min(0).max(1),
  isProvisional: z.boolean(),
  categoryBreakdown: z.array(z.object({ category: Category, cap: z.number(), applied: z.number() })),
  rulesVersion: z.string(),
});
```

Adapter output schemas live in `06-tinyfish-integration.md` and are implemented in `lib/adapters/schemas.ts`.

## Indexing and retention

- Index: `cases(subject_id, created_at desc)`, `findings(case_id)`, `source_runs(case_id)`, `watches(next_run_at) where active`, `alerts(acknowledged_at, created_at desc)`.
- Retention (hackathon): none. Raw output kept for audit/debug; production would add TTL and redaction.
