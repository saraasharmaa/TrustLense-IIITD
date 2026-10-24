# 02 — Functional Requirements Document (FRD)

Defines exact behaviour. IDs are referenced by tests and the build plan. "MUST" = required for its priority tier.

---

## FR-1 Subject intake and identifier validation

**FR-1.1** The system MUST accept one of: GSTIN, CIN, Udyam number, or company name (name triggers FR-2).
**FR-1.2 GSTIN validation** (`lib/identifiers/gstin.ts`):
- Normalise: trim, uppercase.
- Regex: `^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`.
- State code (first 2 digits) MUST be in the known state/UT code table (01–38, 97, 99 accepted).
- Checksum (15th char): for the first 14 chars, with alphabet `0-9A-Z` (index 0–35), multiply each char's index by 1 for even positions (0-based) and 2 for odd positions; add `floor(p/36) + (p mod 36)` per char to a running sum; expected checksum char = alphabet[(36 − sum mod 36) mod 36].
- Derive: `pan = chars[2..12]`, `stateCode`, `stateName`, `entityType` from PAN's 4th char (C=Company, F=Firm/LLP, P=Individual, H=HUF, A=AOP, T=Trust, B=BOI, L=Local Authority, J=Artificial Juridical Person, G=Government).
**FR-1.3** CIN validation: `^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$`; derive listing status (L/U), state, incorporation year.
**FR-1.4** Udyam: `^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$`.
**FR-1.5** Invalid identifiers return `400 invalid_identifier` with a human message naming the failing check (format/state/checksum). No network call is made for invalid input.
**AC-1:** Given `33AABCS7345M1Z3`, validation passes and derives PAN `AABCS7345M`, state Tamil Nadu, entityType Company. Given the same string with the last char changed, it fails checksum.

## FR-2 Entity resolution (P1)

**FR-2.1** `POST /api/resolve {query}` returns up to 5 candidates `{legalName, gstin?, cin?, state?, city?, confidence 0..1, sourceUrl}`.
**FR-2.2** Implementation: TinyFish Search for the query plus identifier-oriented terms → LLM extracts candidate entities from result snippets → zod-validated → ranked by confidence. Candidates with a GSTIN MUST pass FR-1.2.
**FR-2.3** The UI MUST require the user to pick a candidate; the system never auto-selects when confidence < 0.9 or when two candidates are within 0.1.
**AC-2:** An ambiguous name returns ≥2 candidates and no case starts until one is chosen.

## FR-3 Case lifecycle and orchestration

**FR-3.1** `POST /api/cases` creates a `case` (status `queued`) and enqueues execution immediately (in-process). Returns `caseId` within 500 ms.
**FR-3.2** Execution (`lib/orchestrator/runCase.ts`):
1. Emit `case.started`.
2. Select adapters: requested set ∩ adapters whose required inputs are present (e.g. MCA needs CIN; if only GSTIN is known and the CIN is unknown, the MCA adapter first tries name-based lookup; if that fails, it is `skipped` with reason `missing_identifier`).
3. Run adapters concurrently, max `MAX_PARALLEL_ADAPTERS` (default 6), each with timeout `ADAPTER_TIMEOUT_MS` (default 90000).
4. Per adapter: 1 retry on `failed`/`timeout` (not on `captcha_blocked` or `not_found`), exponential backoff 2s.
5. After each adapter settles: normalise → findings (FR-5) → emit events.
6. When all settle (or global cap `CASE_TIMEOUT_MS` default 180000 is hit, marking unfinished adapters `timeout`): compute coverage and score (FR-6), generate narrative (FR-7), persist, emit `report.ready`, set case `completed` (all adapters succeeded/not_found) or `partial` (any failed/blocked/timeout/skipped) or `failed` (zero adapters produced data).
**FR-3.3** An adapter failure MUST NOT abort other adapters or the case.
**FR-3.4** `POST /api/cases/:id/rerun {sources?: string[]}` re-runs only the given adapters, keeps other source runs, recomputes score/narrative, and creates a new report version.
**AC-3:** With the GST adapter forced to throw, the case completes as `partial`, other lanes finish, coverage < 100%, and the report is produced.

## FR-4 Source adapters

Each adapter implements `SourceAdapter` (see `06`): `id`, `label`, `requires`, `tier`, `run(input, ctx) → AdapterResult`. Output schemas are in `06-tinyfish-integration.md`. Statuses: `succeeded`, `not_found`, `captcha_blocked`, `failed`, `timeout`, `skipped`.

| Adapter | Source(s) | Requires | Pri |
|---|---|---|---|
| `gst` | GST portal public taxpayer search + return status | GSTIN | P0 |
| `news` | Open web news via TinyFish Search + Fetch, classified by LLM | legalName (+ city/state/directors for disambiguation) | P0 |
| `mca` | MCA company master data (+ charges if accessible) | CIN or name | P0 |
| `legal` | eCourts / NCLT / IBBI public notices | legalName (+ state) | P1 |
| `udyam` | Udyam registration verification | Udyam number or name | P2 |
| `regulatory` | SEBI orders, MCA disqualified directors, other public lists | legalName + director names | P2 |

**FR-4.1** Each adapter MUST emit progress events (`source.progress`) derived from TinyFish stream events (step text, current URL when available), throttled to ≤ 2/s per source.
**FR-4.2** Adapters MUST return `rawOutput` (untouched TinyFish result) and `normalized` (zod-validated). Parse failure → `failed`.
**FR-4.3** Adapters MUST NOT attempt CAPTCHA bypass. A visible CAPTCHA → `captcha_blocked`.
**FR-4.4** If `DEMO_MODE=true`, or an adapter has `forceReplay`, results come from `fixtures/demo-companies.json` (matched by GSTIN) with simulated progress timing 1–6s per lane, and `source.replay=true` in events and storage.
**FR-4.5 Cross-source reconciliation:** after adapters finish, compare: GST legal name vs MCA name vs Udyam name (fuzzy ≥ 0.85 token-set ratio = match); GST principal-place state vs MCA registered-address state. Mismatches become findings (see rules).

## FR-5 Findings and evidence

**FR-5.1** A finding: `{id, ruleId, category, severity, title, detail, penalty, hardStop, confidence, evidence[]}`. Evidence: `{sourceRunId, url, retrievedAt, excerpt (≤ 300 chars)}`.
**FR-5.2** Findings are produced by the scoring rules (FR-6) from normalised data, plus informational findings (e.g. positive news, source unavailable). A finding with no evidence MUST NOT be created, except `COVERAGE-*` informational findings, whose evidence is the failed source run itself.
**FR-5.3** Severity: `info | low | medium | high | critical`. Colour is never the sole indicator (icon + label).

## FR-6 Scoring

Implement exactly `07-scoring-spec.md`: categories with caps, rule groups (highest applicable penalty per group), hard stops, grade bands, recommendation, coverage and provisional logic. Output: `{score, grade, recommendation, coverage, isProvisional, categoryBreakdown[], findings[], rulesVersion}`.
**AC-6:** Fixtures reproduce `expected` values in `fixtures/demo-companies.json` (Aravali 97/A, Sunrise 66/C, Kaveri 9/D, Sunrise after change 38/D). Unit tests cover every rule and every hard stop.

## FR-7 Narrative generation

**FR-7.1** After scoring, call the LLM with only the findings, score, grade and coverage. Output JSON (zod-validated): `{headline, summary (≤ 120 words), keyRisks[≤5], strengths[≤3], suggestedConditions[≤4], questionsForBorrower[≤4]}`; each item cites finding IDs.
**FR-7.2** Validation: all cited IDs MUST exist; no numbers/dates not present in findings (best-effort check: reject if a 4-digit year or ₹ amount appears that is not in findings). On any failure → deterministic template narrative built from top findings.
**FR-7.3** The narrative never states approval/rejection; it may say "recommendation: …" echoing the rule-derived recommendation.
**FR-7.4** Timeout 20s; failure → template narrative, case still completes.

## FR-8 Live progress streaming

**FR-8.1** Every orchestrator step writes a `case_events` row (monotonic `seq` per case) and pushes to subscribers.
**FR-8.2** `GET /api/cases/:id/stream` (SSE) replays events with `seq > Last-Event-ID` (or all), then streams live; sends heartbeat comment every 15s; closes after `report.ready` or `case.failed`.
**FR-8.3** The run view MUST work after page refresh and in two tabs at once.
**AC-8:** Refresh mid-run → lanes restore to current state and continue.

## FR-9 Report and evidence UI

**FR-9.1** Header: company, identifiers, score gauge, grade, recommendation, coverage bar, "Provisional" and "Replay data" badges where applicable, run timestamp.
**FR-9.2** Narrative card; category breakdown (5 bars with penalty/cap); findings list sorted by severity, grouped by category, each expandable to evidence with source link, retrieved-at, excerpt, and the rule explanation (`ruleId`, what triggered it, penalty).
**FR-9.3** Sources panel: per-adapter status, duration, attempts, "retry" action for failed ones.
**FR-9.4** Disclaimer footer: decision-support only; data from public sources at the time shown; verify before acting.

## FR-10 Monitoring and alerts

**FR-10.1** `POST /api/cases/:id/watch {frequencyHours}` creates a watch with baseline = that case. Allowed frequencies: 6, 24, 168.
**FR-10.2** `POST /api/cron/monitor` (Bearer `CRON_SECRET`) finds due watches, runs a monitoring case (cheap adapters: `gst`, `news`, plus `legal` if enabled), scores, and diffs vs the previous completed case.
**FR-10.3 Diff** (`lib/monitor/diff.ts`): detect grade change, score delta ≥ 5, new findings (by `ruleId` + key), resolved findings, hard-stop appearing. Alert severity: hard stop or grade drop ≥ 2 bands → `critical`; grade drop 1 band → `high`; new high finding → `high`; other new findings → `medium`; improvements → `info`.
**FR-10.4** An alert stores the before/after summary and links to both cases. UI: bell badge with unread count, Watchlist page with timeline, alert detail with before/after.
**FR-10.5** In-process scheduler (setInterval, 60s) also triggers the monitor in dev/local so the cron endpoint is optional.
**FR-10.6 Demo simulation:** `POST /api/demo/simulate-change {watchId}` loads the fixture snapshot `t1` for that subject, runs the normal pipeline with it, and creates the alert. Labelled "Simulated" in UI.
**AC-10:** Watching Sunrise (grade C), then simulating change, yields a `critical` alert: GST suspended (hard stop), grade C → D, with before/after view.

## FR-11 Export

**FR-11.1** `GET /api/cases/:id/export?format=json` returns the full report (subject, source runs summary, findings with evidence, score, narrative, rulesVersion, generatedAt).
**FR-11.2** `/cases/:id/print` renders a print-optimised page (`@media print`), suitable for browser "Save as PDF". Includes the disclaimer and replay/provisional badges.

## FR-12 Demo / replay mode

**FR-12.1** Global toggle via env `DEMO_MODE` and per-case `mode` field. UI shows a persistent banner in demo mode and per-source "Replay" badges.
**FR-12.2** Seed command loads the 3 fixture companies as saved subjects; the home page shows them as "Try a demo company" chips (also in live mode, where they run as replay and are labelled).
**FR-12.3** "Record last live run" (P2): store a live case so it can be replayed later, labelled "Recorded live run, <timestamp>".

## FR-13 Errors, limits, logging

- Error shape in `05-api-spec.md`. Rate limit: 10 case creations/min/IP (in-memory).
- Structured JSON logs: `caseId`, `adapter`, `status`, `durationMs`, `attempt`, `tinyfishRunId`.
- No stack traces or secrets in API responses.

## Error-handling matrix

| Condition | Source status | Case effect | UI |
|---|---|---|---|
| TinyFish 4xx/5xx | `failed` (after retry) | partial | red lane, retry button |
| Agent returns invalid JSON | `failed` (`parse_error`) | partial | lane error, raw output viewable |
| CAPTCHA | `captcha_blocked` | partial | amber lane "Blocked by CAPTCHA" |
| No record found | `not_found` | counts as covered | grey lane "No record"; may itself create a finding (e.g. Udyam not found, low) |
| Timeout | `timeout` | partial | amber lane |
| Missing identifier | `skipped` | partial | grey lane "Needs CIN" |
| LLM failure | n/a | completes with template narrative | small "Template summary" tag |
| DB write failure | n/a | case `failed` with message | error screen with retry |

## Acceptance test checklist (P0)

- [ ] AC-1 identifier validation
- [ ] AC-3 adapter failure isolation
- [ ] AC-6 scoring matches fixtures
- [ ] AC-8 SSE replay after refresh
- [ ] AC-10 watch → simulated change → critical alert with diff
- [ ] Every finding has evidence with a URL
- [ ] Demo mode badges visible; no fixture shown as live
- [ ] Partial report displays coverage < 100% and Provisional when coverage < 60%
