# PROGRESS

Update at the end of every milestone. Keep it short and factual.

## Next up

- **Next up (A):** open the PR for `feat/orchestrator`; when B's scoring/identifiers land, delete `lib/orchestrator/temp-scoring-stub.ts` and wire the real code. Then M2: check https://docs.tinyfish.ai, write `lib/tinyfish/client.ts`, GST and News adapters, spike script.
- **Next up (B):** M1 `lib/identifiers`, `lib/scoring`, home page and run view, on a `feat/*` branch from `main`.

## Requests for B

Scoring and identifiers are called by A's orchestrator through these signatures. Tell A in this section if B needs a different shape.

- `evaluate(outcomes: SourceOutcomes, ctx: { now: Date; requested: AdapterId[] }): Finding[]` — `SourceOutcomes`/`SourceOutcome` are in `lib/adapters/types.ts`. `normalized` is the zod-parsed adapter output (`lib/adapters/schemas.ts`); replay payloads have `status: "ok"` inside it. Each finding's evidence uses `outcome.evidenceUrl`, `outcome.retrievedAt`, `outcome.sourceRunId` and `outcome.isReplay`.
- `score(findings: Finding[], outcomes: SourceOutcomes): ScoreResult` — coverage counts `succeeded`, `not_found` and `carried_forward`.
- `validateGstin(input: string)` returning the derived PAN, state code, state name and entity type, or throwing `AppError("invalid_identifier", ...)`; same shape for CIN and Udyam.
- `lib/types.ts` and `lib/db/schema.ts` are A's; ask A before editing.

- The orchestrator replaces each finding's `id` with a fresh UUID after `evaluate`, so use any placeholder id.
- `GET /api/cases/:id` returns `subject.stateCode` only; the state name needs B's state table. Tell A if the API should return it.
- Replay evidence URLs look like `https://example.invalid/replay/<adapter>/<companyKey>`; `outcome.isReplay` is true for them.

## Requests for A

- 

## Status

| Milestone | Status | Notes |
|---|---|---|
| M0 Scaffold | done (A), untested against a live DB | Next 15, schema, health route, fixtures loader. `db:push` and `db:seed` need `DATABASE_URL` in `.env.local` |
| M1 Demo-mode vertical slice | A part done on `feat/orchestrator` (PR not opened: no `gh`) | Adapters, replay, orchestrator, cases/SSE/demo routes verified in demo mode against a local DB. Scoring is a temporary stub, so no score yet. B part (identifiers, scoring, UI) not started |
| M2 TinyFish live: GST + News | not started | |
| M3 Report experience | not started | |
| M4 MCA + Legal | not started | |
| M5 Monitoring | not started | |
| M6 Polish + resilience | not started | |
| M7 Demo readiness | not started | |

## Spike results (fill from docs/06 §7)

| Adapter | Reaches data? | CAPTCHA/OTP | Median latency | Credits/run | Reliability (x/5) | Tier decision |
|---|---|---|---|---|---|---|
| gst | | | | | | |
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
- 2026-10-24 Env is parsed lazily in `lib/env.ts` so builds and tests don't need a full `.env.local`.

## Blocked / questions for humans

- Tests that need Postgres skip unless `DATABASE_URL` is set. A verified them against a throwaway local database `trustlens_dev` (created with `createdb`, no `.env.local` involved). `drizzle-kit push` asks an interactive question on that database, so a new column was added with `psql`; a fresh database pushes cleanly.
- `gh` (GitHub CLI) is not installed on this machine, so A cannot open PRs, list B's PRs or merge. `feat/scaffold` is pushed; open its PR from the GitHub link, or install and log in to `gh`.
- `.env.local` does not exist yet, so nothing has run against Postgres.

## TinyFish API facts confirmed from live docs

- 
