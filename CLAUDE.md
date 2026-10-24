# CLAUDE.md — TrustLens

> Read this file first, every session. Then read the docs in the order listed under "Read order".

## What we are building

**TrustLens** (placeholder name) is a live due-diligence and credit-risk agent for MSME lending.
A lender or procurement analyst enters a GSTIN, CIN or company name. Parallel web agents (powered by the **TinyFish API**) visit public government portals and the open web, extract compliance, legal and adverse-media signals, and produce an **explainable risk report** with source evidence. Watched companies are re-checked on a schedule and alerts fire when something changes.

It is **decision support, not an automated lending decision.** Humans decide.

This is a 24-hour hackathon build (HackIIITD 2026, judged on execution, innovation, scalability, TinyFish API usage, impact). **A working, demoable vertical slice beats breadth.** TinyFish integration is mandatory and must be central.

## Read order

1. `docs/00-vision.md` — why, who, principles
2. `docs/01-PRD.md` — what and for whom, scope cut lines
3. `docs/02-FRD.md` — exact functional behaviour and acceptance criteria
4. `docs/03-architecture.md` — stack, structure, flows, decisions
5. `docs/04-data-model.md` — tables and shared types
6. `docs/05-api-spec.md` — REST + SSE contract
7. `docs/06-tinyfish-integration.md` — client, adapters, prompts, schemas, failure handling
8. `docs/07-scoring-spec.md` — deterministic rules (implement exactly)
9. `docs/08-ui-ux-spec.md` — screens and states
10. `docs/09-build-plan.md` — milestones M0–M7 with acceptance criteria (**work in this order**)
11. `docs/12-claude-code-prompts.md` — kickoff prompts per milestone
Reference as needed: `docs/10-demo-and-pitch.md`, `docs/11-risks-compliance.md`, `fixtures/demo-companies.json`.

## Stack (decided — do not re-litigate)

- **Next.js 15 (App Router) + TypeScript (strict)**, Node runtime for API routes, Tailwind CSS + shadcn/ui, lucide-react icons
- **Postgres** via **Drizzle ORM** (Neon or local Docker). `DATABASE_URL` env.
- **zod** for every external boundary (TinyFish output, LLM output, API input)
- **p-limit** for concurrency, **vitest** for tests
- **Anthropic SDK** (`@anthropic-ai/sdk`) for narrative + news classification; model from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`)
- **TinyFish** via one wrapper: `lib/tinyfish/client.ts`
- Run on a **persistent Node server** (local, Railway, Render, Fly). Do **not** target serverless: agent runs take 30–120s and use SSE.

## Commands

```
npm run dev            # next dev
npm run build && npm start
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # vitest (scoring + identifiers are mandatory test targets)
npm run db:push        # drizzle-kit push
npm run db:seed        # loads fixtures/demo-companies.json as demo subjects
npm run demo           # DEMO_MODE=true next dev
npm run spike -- <adapter> <identifier>   # run one adapter live, print raw + normalized output
```
(Create these scripts in M0 if missing.)

## Non-negotiable rules

1. **Never fabricate data.** If a source fails, is blocked, or returns nothing, record that status (`failed`, `captcha_blocked`, `not_found`, `timeout`). Never fill gaps with guesses, defaults, or LLM-invented facts. Reports must show **coverage** (which sources succeeded).
2. **Every finding carries evidence** (source URL, retrieved-at timestamp, short excerpt). No evidence → no finding.
3. **Scoring is deterministic** and implemented exactly as `docs/07-scoring-spec.md`. The LLM never computes or changes a score, grade, or recommendation. The LLM only (a) classifies news articles and (b) writes the narrative from provided findings.
4. **All TinyFish calls go through `lib/tinyfish/client.ts`.** Adapters never call `fetch` on TinyFish directly. API shapes may differ from docs here — **check https://docs.tinyfish.ai before coding the client** and adjust in that one file.
5. **Adapters are isolated and interchangeable.** Each implements the `SourceAdapter` interface (`lib/adapters/types.ts`). The orchestrator knows nothing about specific portals.
6. **Do not bypass CAPTCHAs, logins, paywalls or rate limits.** If a CAPTCHA appears, return `captcha_blocked`. Public data only.
7. **Demo mode must be honest.** When `DEMO_MODE=true` or a source is served from fixtures/replay, the UI shows a visible "Replay / demo data" badge on that source and on the report. Never present fixtures as live.
8. **Secrets** live only in `.env.local` (git-ignored). Never log API keys or paste them in code, docs or commits.
9. **Validate at boundaries.** Parse TinyFish and LLM outputs with zod; on parse failure mark the source run `failed` with the parse error, do not coerce.
10. **Fixtures are synthetic.** Names/IDs in `fixtures/` are fictional. Don't "improve" them into real companies.

## Code conventions

- TypeScript strict, no `any` (use `unknown` + zod). Prefer pure functions in `lib/scoring`, `lib/identifiers`.
- Files: `kebab-case.ts`; React components `PascalCase.tsx`. Named exports except Next route/page defaults.
- One concern per module. No business logic in route handlers beyond validation + calling `lib/*`.
- Dates ISO `YYYY-MM-DD`; timestamps ISO-8601 UTC; money integer INR (rupees).
- Errors: throw typed `AppError(code, message, details?)`; routes map to the error shape in `docs/05-api-spec.md`.
- Comments explain *why*. Keep functions small. No dead code, no commented-out blocks.
- UI: follow `docs/08-ui-ux-spec.md` tokens; every async view has loading, empty, error, and partial states.

## Directory layout

```
app/                    # Next.js routes (pages + api)
components/             # UI components
lib/
  tinyfish/             # client.ts, types.ts
  adapters/             # types.ts, registry.ts, schemas.ts, gst.ts, mca.ts, legal.ts, udyam.ts, news.ts, regulatory.ts, resolve.ts
  orchestrator/         # runCase.ts, events.ts, retry.ts
  scoring/              # rules.ts, score.ts, grades.ts, *.test.ts
  identifiers/          # gstin.ts, pan.ts, cin.ts, names.ts
  llm/                  # classify-news.ts, narrative.ts, prompts.ts
  db/                   # schema.ts, client.ts, seed.ts
  monitor/              # diff.ts, alerts.ts
  demo/                 # fixtures.ts, replay.ts
scripts/                # spike.ts
fixtures/               # demo-companies.json
docs/                   # specs (this pack)
```

## Work protocol

- Work **milestone by milestone** (`docs/09-build-plan.md`). Finish a milestone's acceptance criteria before starting the next, unless told otherwise.
- After each milestone: run `typecheck`, `lint`, `test`; update `docs/PROGRESS.md` (done / in progress / blocked / decisions); make a focused git commit.
- If a spec is ambiguous or contradicts reality (e.g. TinyFish API differs), choose the simplest option that preserves the non-negotiable rules, note it in `docs/PROGRESS.md` under "Decisions", and continue.
- **Ask the humans before:** adding a new paid service or dependency with a cost, changing the stack, deleting data, or pushing/deploying.
- Prefer a thin vertical slice (demo mode end to end) before live adapters. Live adapters then replace fixtures one at a time.

## Definition of done (per feature)

Works in demo mode **and** (if an adapter) live; typecheck/lint/tests pass; loading/empty/error/partial states handled; evidence and coverage shown; no secrets or fake data presented as real; `docs/PROGRESS.md` updated.
