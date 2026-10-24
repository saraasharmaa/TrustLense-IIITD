# PROGRESS

Update at the end of every milestone. Keep it short and factual.

## Status

| Milestone | Status | Notes |
|---|---|---|
| M0 Scaffold | done (A), untested against a live DB | Next 15, schema, health route, fixtures loader. `db:push` and `db:seed` need `DATABASE_URL` in `.env.local` |
| M1 Demo-mode vertical slice | not started | |
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

- 

## TinyFish API facts confirmed from live docs

- 
