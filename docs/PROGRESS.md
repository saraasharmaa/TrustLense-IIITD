# PROGRESS

Update at the end of every milestone. Keep it short and factual.

## Next up

- **Next up (A):** put keys in `.env.local`, run `npm run spike -- gst <GSTIN> --runs 3` and `npm run spike -- news "<name>" --runs 3`, fill the spike table, and decide live or replay per adapter; then M7 (README section on the backend, final `demo:check`).
- **Next up (B):** merge-ready: `feat/scoring` PR. Then M1 UI on `feat/ui-home` from `main`: home page with live identifier validation and demo chips, then the run view (`/cases/[id]`) with agent lanes, findings feed and score ring, built against docs/05 and the real routes.

## Requests for B

Scoring and identifiers are called by A's orchestrator through these signatures. Tell A in this section if B needs a different shape.

- `evaluate(outcomes: SourceOutcomes, ctx: { now: Date; requested: AdapterId[] }): Finding[]` — `SourceOutcomes`/`SourceOutcome` are in `lib/adapters/types.ts`. `normalized` is the zod-parsed adapter output (`lib/adapters/schemas.ts`); replay payloads have `status: "ok"` inside it. Each finding's evidence uses `outcome.evidenceUrl`, `outcome.retrievedAt`, `outcome.sourceRunId` and `outcome.isReplay`.
- `score(findings: Finding[], outcomes: SourceOutcomes): ScoreResult` — coverage counts `succeeded`, `not_found` and `carried_forward`.
- `validateGstin(input: string)` returning the derived PAN, state code, state name and entity type, or throwing `AppError("invalid_identifier", ...)`; same shape for CIN and Udyam.
- `lib/types.ts` and `lib/db/schema.ts` are A's; ask A before editing.

- The orchestrator replaces each finding's `id` with a fresh UUID after `evaluate`, so use any placeholder id.
- `GET /api/cases/:id` returns `subject.stateCode` only; the state name needs B's state table. Tell A if the API should return it.
- Replay evidence URLs look like `https://example.invalid/replay/<adapter>/<companyKey>`; `outcome.isReplay` is true for them.

- `news` articles carry `publishedDate` read by the LLM from the article text (Search/Fetch return no date). It can be `null`: decide in scoring how NEWS-01/02 treat an undated article (suggest: info finding, no penalty, because the 24-month rule can't be checked).
- Live adapters never set `matchConfidence` on legal items yet (M4).

- `POST /api/cases/:id/rerun` returns `202 {caseId, sources}` (no `version`, per the in-place rerun decision). With no body it reruns every failed, timed-out or CAPTCHA-blocked source; it returns 409 while the case is running. The stream then continues with new events on the same case; reconnect with the last seen `Last-Event-ID`.
- `GET /api/cases/:id/export?format=json` downloads the same shape as `GET /api/cases/:id` plus `generatedAt`.
- `narrative.source` is `"llm"` or `"template"`; the template is used when the model is unconfigured, fails, or breaks the FR-7 checks.

- Legal items now carry `matchConfidence` (0.4 base, +0.3 state, +0.2 city, +0.3 director; a different party name caps it at 0.4). Items below 0.7 must be info-only "possible match". MCA output has `registeredAddress` and GST output `principalPlace` for BIZ-03; BIZ-02 can compare `legalName`/`companyName`/`enterpriseName`.
- MCA directors are saved on the subject after a successful run, but news/legal in the same run start in parallel, so they only benefit on the next run or rerun.

- Monitoring API: `POST /api/cases/:id/watch {frequencyHours: 6|24|168, adapters?}` (409 if already watched or the case is unfinished), `GET /api/watches`, `PATCH /api/watches/:id` (204), `GET /api/alerts?unread=1`, `POST /api/alerts/:id/ack` (204), `POST /api/demo/simulate-change {watchId}` (only with `DEMO_MODE` or `ALLOW_SIMULATION`). A monitoring case has `triggeredBy: "monitor"|"simulation"`. Carried-forward sources get no new `sourceRuns` row, so the UI should say "carried forward" for any category whose adapter is missing from that case's `sourceRuns`.

## Requests for A

- Identifier validators return `{ ok: true, value }` or `{ ok: false, check, message }` so the UI can show the failing check without catching. For routes and the orchestrator use `orThrow(validateGstin(x))` from `lib/identifiers/types.ts`; it throws `AppError("invalid_identifier", message, { check })`. `validateGstin` returns `{ gstin, pan, stateCode, stateName, entityType }`; `validateCin` and `validateUdyam` have the same shape.
- Wire scoring with `import { evaluate, score } from "@/lib/scoring"`; the signatures are exactly the ones listed under Requests for B. `score` never returns `null`, so the stub's `ScoreResult | null` handling can go.
- `evaluate` re-parses `outcome.normalized` with `lib/adapters/schemas.ts` and ignores an outcome that has no `evidenceUrl` (rule 2: no evidence, no finding). Coverage still counts such an outcome, so live adapters should always set `evidenceUrl` to the page they read.
- `LegalOutput.role` only allows `Petitioner | Respondent | Other`, so LEG-02/03 count `Respondent` only; docs/07 also names Defendant and Accused. Not a problem for fixtures; tell B if the MCA/Legal adapter needs them.
- COVERAGE findings for a source that never ran have empty `evidence`, because `Evidence.url` is required and there is no run to point at. Treat the empty list as intended for `COVERAGE-*` only.

## Status

| Milestone | Status | Notes |
|---|---|---|
| M0 Scaffold | done (A), untested against a live DB | Next 15, schema, health route, fixtures loader. `db:push` and `db:seed` need `DATABASE_URL` in `.env.local` |
| M1 Demo-mode vertical slice | A part and B identifiers and scoring merged; real scoring wired in `feat/wire-scoring`; B UI not started | `npm run demo:check` passes: Aravali 97/A, Sunrise 66/C, Kaveri 9/D and the Sunrise simulated change raises a critical C to D alert |
| M2 TinyFish live: GST + News | code done on `feat/tinyfish`; not run live | Client, GST and News adapters, cache, spike script, all unit-tested with mocks. Live spike needs `TINYFISH_API_KEY` and `ANTHROPIC_API_KEY` in `.env.local` (file does not exist yet) |
| M3 Report experience | A part done on `feat/report-api` (rerun, export, LLM narrative); B part (report UI) not started | Verified with replay and mocked LLM; no live keys yet |
| M4 MCA + Legal | A part done on `feat/mca-legal` (adapters, match confidence, directors); BIZ-02/03 rules are B's | Unit-tested with mocks; live reliability unknown until the spike |
| M5 Monitoring | A part done on `feat/monitor` (diff, watches, alerts, scheduler, cron, simulate-change); UI is B's | AC-10 is asserted exactly in `lib/monitor/monitor.test.ts` with the real engine (C to D, 66 to 38, critical) |
| M6 Polish + resilience | A part done on `feat/polish` (rate limit, debug page, `demo:check`); a11y, states, copy, README are B's | `npm run demo:check` passes against a local database |
| M7 Demo readiness | not started | |

## Spike results (fill from docs/06 §7)

| Adapter | Reaches data? | CAPTCHA/OTP | Median latency | Credits/run | Reliability (x/5) | Tier decision |
|---|---|---|---|---|---|---|
| gst | not run (no key) | expected: image CAPTCHA on services.gst.gov.in/services/searchtp | | | | |
| news | | | | | | |
| mca | | | | | | |
| legal | | | | | | |
| udyam | | | | | | |
| regulatory | | | | | | |

## Decisions

- 2026-10-24 Replay wrapper maps adapter status `ok` to `SourceStatus` `succeeded` — fixtures use `ok`, the DB and API use `succeeded`.
- 2026-10-24 Added `carried_forward` to `SourceStatus` (types and DB enum) — docs/07 counts it toward coverage.
- 2026-10-24 Reruns overwrite the report in place; no `version` column on cases, findings, source_runs or events — simplest MVP option.
- 2026-10-24 Narrative validator enforces FR-7's 120-word summary limit, in addition to the zod 900-char cap.
- 2026-10-24 Replay evidence uses a clearly labelled replay URL, since GST/MCA fixtures carry none.
- 2026-10-24 Scheduler hook will live in `instrumentation.ts` (M5).
- 2026-10-24 `Idempotency-Key` and cursor pagination skipped unless an acceptance criterion needs them.
- 2026-10-24 B owns `lib/scoring` and `lib/identifiers`; the orchestrator is built against the `evaluate`/`score` signatures in docs/07 and wired after B's branch merges.
- 2026-10-24 `tsx` approved as a dev dependency for `db:seed` and `spike`; shadcn/ui left to B.
- 2026-10-24 Scaffolded by hand (create-next-app refuses a non-empty repo); TypeScript pinned to 5.x, vitest to 3.x because vitest 4 failed to install with this npm.
- 2026-10-24 News classification also extracts `publishedDate` from the article text, because TinyFish Search and Fetch return no dates and docs/07 needs article age.
- 2026-10-24 Source cache wraps live adapters in `runCase`; only `succeeded`/`not_found` results are cached, monitor runs and `fresh: true` skip it, and a cache hit keeps its original `retrievedAt`.
- 2026-10-24 `DATABASE_URL` is optional at parse time so `npm run spike` works without a database; `db()` throws if it is missing.
- 2026-10-24 Narrative validation rejects unknown finding ids, years or rupee amounts not present in the findings, summaries over 120 words, and approve/reject wording; any failure falls back to the template.
- 2026-10-24 `source_runs.evidence_url` added so reruns (and later the monitor) can rebuild evidence from stored runs.
- 2026-10-24 Reruns bypass the source cache, rerun by default only failed/timeout/captcha_blocked sources, and refuse while a case is running (409).
- 2026-10-24 Legal runs two agents (eCourts case search and IBBI public announcements) and is only `succeeded`/`not_found` if both were reached; a block or error on either is reported as that status so a blocked source never reads as "no cases". NCLT cause lists are not covered yet.
- 2026-10-24 Legal items gain optional `partyName`/`partyDetails` (as shown on the page) so match confidence can be computed; they are not used for scoring.
- 2026-10-24 Monitoring carries clean results (succeeded/not_found) over from the previous case as `carried_forward` and re-checks only the watch's adapters (default gst, news); monitor runs skip the source cache.
- 2026-10-24 `simulate-change` replays fixture snapshot `t1` in demo mode against the watch's last case; it returns 409 rather than inventing an alert when nothing changed or no score exists.
- 2026-10-24 Rate limit is in memory, 10 case creations per minute per `x-forwarded-for` IP (or one shared bucket locally), answering 429 `rate_limited`.
- 2026-10-24 `/debug/cases/[id]` is a plain server page, 404 in production builds, showing raw runs, steps, errors, credits and events.
- 2026-10-24 `demo:check` runs in process (no server): database, each fixture in replay against its expected score/grade, and the Sunrise simulated change; it exits non-zero on any failure.
- 2026-10-24 Env is parsed lazily in `lib/env.ts` so builds and tests don't need a full `.env.local`.
- 2026-10-24 B: GST state codes come from the GST e-invoice master codes page (gst.gov.in). It has no code 28, so a GSTIN starting 28 is rejected although FR-1.2 says 01-38; no official source was found for legacy Andhra Pradesh 28. Pending the humans' call.
- 2026-10-24 B: CIN state letters are NOT from an official source (MCA publishes none). An unknown code gives `stateName: null`, never a rejection.
- 2026-10-24 B: scoring ports `score_reference.py`, but follows docs/07 where the reference is looser and fixtures agree: GST-02/03 look at the last 12 GSTR-3B rows only, GST-02 needs at least 3 returns, and a null `companyStatus` or date is never penalised.
- 2026-10-24 B: rules with a per-record fingerprint (LEG-01/02/04, NEWS-01/02, REG-01, MCA-03) emit one finding per record, so a new article or case raises a new alert. The rule group still counts only the highest penalty, so the other findings show `appliedPenalty` 0.
- 2026-10-24 B: undated or older-than-24-month adverse articles become `NEWS-STALE` info findings, and low-confidence legal, news and regulatory matches become `LEG-POSSIBLE`, `NEWS-POSSIBLE` and `REG-POSSIBLE` info findings; none are scored.
- 2026-10-24 B: BIZ-01 fires on a `not_found` Udyam outcome only; the "provided Udyam number could not be verified" case needs the input number, which `evaluate` does not receive.

## Blocked / questions for humans

- **M2 not verified live (agreed):** the TinyFish client, GST and News adapters are tested only with mocks. No live run has happened because `.env.local` has no `TINYFISH_API_KEY` or `ANTHROPIC_API_KEY`; the spike table above stays empty until then.
- Tests that need Postgres skip unless `DATABASE_URL` is set. A verified them against a throwaway local database `trustlens_dev` (created with `createdb`, no `.env.local` involved). `drizzle-kit push` asks an interactive question on that database, so a new column was added with `psql`; a fresh database pushes cleanly.
- `gh` (GitHub CLI) is not installed on this machine, so A cannot open PRs, list B's PRs or merge. `feat/scaffold` is pushed; open its PR from the GitHub link, or install and log in to `gh`.
- `.env.local` does not exist yet, so nothing has run against Postgres.

## TinyFish API facts confirmed from live docs

Checked 2026-10-24 against docs.tinyfish.ai. Where it differs from docs/06, the client follows the live docs; only `lib/tinyfish/client.ts` encodes this.

- Auth for Agent, Search and Fetch: `X-API-Key` header.
- Agent: `POST https://agent.tinyfish.ai/v1/automation/run-sse`, body `{url, goal, output_schema?, browser_profile: "lite"|"stealth", proxy_config?{enabled,type,country_code}, agent_config?{max_steps,max_duration_seconds}}`. docs/06 said `default|stealth`; the real values are `lite|stealth`.
- Agent SSE events: `STARTED{run_id}`, `STREAMING_URL`, `PROGRESS{purpose}`, `HEARTBEAT`, `COMPLETE{run_id,status,result?,error?}`. There is no separate failure event: failures arrive in `COMPLETE.error{code,message,category,retry_after}`.
- `COMPLETED` only means the run finished; the goal can still have failed inside `result`, so adapters validate `result` with zod. Run-level error codes include `SITE_BLOCKED`, `TASK_FAILED`, `MAX_STEPS_EXCEEDED`, `TIMEOUT`, `BILLING_REJECTED`.
- The stream has no `Last-Event-ID` resume. A cut stream is reported as an error (polling `GET /v1/runs/{id}` is possible but not implemented).
- No credits or usage figure appears in the stream, so `source_runs.credits` stays empty for now.
- Search: `GET https://api.search.tinyfish.ai?query=...` (also `domain_type=news`, `recency_minutes`, `after_date`, `location`), results `{position, site_name, title, snippet, url}`. Results carry no published date.
- Fetch: `POST https://api.fetch.tinyfish.ai`, body `{urls: [..up to 10], format: markdown|html|json}`, response `{results:[{url, final_url, title, text}], errors:[{url, error}]}`; per-URL failures come back inside a 200.
- Search is free to 12,000 requests/day and Fetch to 1,000 URLs/day; Agent draws from the wallet (a 402 `INSUFFICIENT_CREDITS` means a top-up is needed). 
