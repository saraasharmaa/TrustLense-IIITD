# 09 — Build Plan (24-hour finale)

Team of 2–4. Roles (merge if fewer): **A — Agents** (TinyFish client, adapters), **B — Backend** (DB, orchestrator, SSE, scoring, monitor), **C — Frontend** (UI), **D — Product/Pitch** (QA, fixtures, demo, deck, mentor sessions). With Claude Code, A/B/C each drive their own milestone tasks in parallel branches; D reviews acceptance criteria.

## Before the event (planning only)

- [ ] Every member creates a TinyFish account (required) and gets the API key.
- [ ] **Ask the organisers whether pre-written code or scaffolding is allowed.** Round 1 rules say not to submit code; the finale rules on pre-built code are not stated. Assume you start coding at kickoff unless told otherwise. These docs are planning material.
- [ ] Try each target portal flow **manually in the TinyFish playground** with public identifiers (no code). Record results in the spike table (`06` §7).
- [ ] Decide the demo adapters (live vs replay) from the spike results.
- [ ] Create accounts: Neon (Postgres), Anthropic API key, (optional) Railway/Render. Keep keys in a password manager, not in chat.
- [ ] Finish the Round 1 deck (`10-demo-and-pitch.md`), check the Unstop deadline, submit early.
- [ ] Charge laptops, bring extension boards, mobile hotspot backup.

## Milestones

### M0 — Scaffold (H0–H2)
Tasks: `create-next-app` (TS, Tailwind, App Router); shadcn/ui; Drizzle + Postgres + `db:push`; zod; vitest; eslint/prettier; `lib/types.ts` from `04`; `.env.local` from `.env.example`; `/api/health`; fixtures loader; `docs/PROGRESS.md`; git repo + branch rules (`main` protected by convention; short-lived feature branches).
**Accept:** `npm run dev` serves a page; `/api/health` OK; `npm test` runs; schema pushed; fixtures load.

### M1 — Vertical slice in demo mode (H2–H7)
Tasks: identifier validators (GSTIN/CIN/PAN/Udyam) + tests (AC-1); scoring engine + tests against fixtures (AC-6, matches `fixtures/score_reference.py`); orchestrator with replay adapters (simulated timing); event log + SSE (AC-8); `POST/GET /api/cases`; Home page; run view with lanes and findings feed.
**Accept:** Entering a demo GSTIN shows lanes progressing, findings appearing, final score/grade matching fixtures; refresh mid-run restores state.

### M2 — TinyFish live: GST + News (H5–H12)  *(parallel with M1 UI work)*
Tasks: `lib/tinyfish/client.ts` (Agent SSE, Search, Fetch) per the live docs; `npm run spike`; GST adapter with goal + zod schema; News adapter (Search → Fetch → LLM classify with disambiguation); per-adapter timeout/retry/cache; `captcha_blocked` handling; live-vs-replay badges.
**Accept:** At least GST **or** News runs live end to end on a real public identifier with valid schema output; failures degrade to a visible lane state; no crashes.

### M3 — Report experience (H8–H15)
Tasks: report page sections (header, narrative, breakdown, findings, evidence drawer, sources panel); LLM narrative + template fallback + validation (FR-7); coverage and provisional UI; retry per source (`/rerun`).
**Accept:** AC-3 (adapter failure isolation) demonstrated; every finding shows evidence with link; Provisional shows when coverage < 60%.

### M4 — MCA + Legal adapters (H10–H16)
Tasks: MCA adapter (+ directors saved on subject), Legal adapter with name-collision confidence; reconciliation findings (BIZ-02/03). Use the spike's tier decision (live / live + fallback / replay-only).
**Accept:** At least one more live adapter, or an explicitly labelled replay with the reason shown.

### M5 — Monitoring (H14–H19)
Tasks: watches + alerts tables/routes; monitor runner (carried-forward logic); diff; in-process scheduler; Watchlist page; bell + toast; `simulate-change` using fixture `t1`.
**Accept:** AC-10: watch Sunrise (C) → simulate change → critical alert "C → D", before/after view, evidence for GST suspension.

### M6 — Polish + resilience (H18–H22)
Tasks: print view + JSON export; error/empty/loading states; accessibility pass; Udyam/Regulatory if time; rate limit; debug page; copy review; seed demo data; deploy or lock the local run; performance check (first lane < 1s).
**Accept:** Full acceptance checklist in `02-FRD.md` ticked; demo rehearsed on the real machine and network.

### M7 — Demo prep and submission (H21–H24)
Tasks: freeze features at **H22** (bugfix only); 2 full rehearsals (live + replay); record a backup screen video; final slides; prepare for judge Q&A; write a README with architecture + how TinyFish is used; submit/present.

## Cut lines if behind

| At | If behind, cut |
|---|---|
| H12 | Udyam, Regulatory, history/compare, PDF polish |
| H16 | Name resolution (GSTIN-only), MCA live (use labelled replay) |
| H19 | Alert delivery beyond in-app; reruns beyond per-source retry |
| Never | GST + News live, scoring + tests, evidence + coverage, run view, watch + simulated alert, replay badge |

## Mentor checkpoint plan

Use each mentoring session for something specific: (1) architecture/TinyFish integration sanity (after M1), (2) product framing and what judges see (after M3), (3) demo script and pitch dry run (after M5). Ask TinyFish mentors directly about portal-specific flows, CAPTCHA behaviour, rate limits, and the best Search → Fetch → Agent escalation.

## Git and collaboration

- Trunk: `main`. Branches: `feat/<area>`. Small PRs or direct merges with a quick review from another member. Rebase before merge.
- Commit after each milestone and each adapter. Conventional-ish messages (`feat:`, `fix:`, `docs:`).
- One person owns `lib/types.ts` and `lib/db/schema.ts` changes to avoid conflicts.
- Update `docs/PROGRESS.md` at every milestone.

## Definition of done (per milestone)

Acceptance criteria met · typecheck, lint, tests green · works in demo mode (and live where applicable) · states handled · evidence/coverage visible · PROGRESS.md updated · committed.

## Risk mitigations specific to the build

- **Portal changes/CAPTCHA:** spike early, tier adapters, replay fallback, honest labels.
- **Wi-Fi issues:** hotspot backup; local DB option; replay mode needs no internet.
- **Credit exhaustion:** cache + cheap adapters for monitoring; check usage hourly.
- **Merge chaos:** adapter-per-file, single owner for schema/types.
- **Over-scoping:** the cut-line table is binding.
