# 12 — Claude Code Kickoff Prompts

How to use: unzip this pack into an empty git repo (keep `CLAUDE.md` at the root and `docs/`, `fixtures/` as is). Open a terminal in the repo, run `claude`, and paste the prompts below **one milestone at a time**. After each, review the diff, run the app, and tick the acceptance criteria in `docs/09-build-plan.md`.

Tips: keep each session focused on one milestone; use `/clear` between milestones (CLAUDE.md is re-read automatically); if Claude Code proposes deviating from the docs, ask it to explain and record the decision in `docs/PROGRESS.md`.

---

## Prompt 0 — Orientation (always first)

```
Read CLAUDE.md, then every file in docs/ in the order CLAUDE.md lists, and fixtures/demo-companies.json and fixtures/score_reference.py.
Do not write code yet. Reply with: (1) a 10-line summary of the product and architecture, (2) the 5 riskiest assumptions, (3) any contradictions or gaps you found between documents, (4) your proposed task list for milestone M0 with file paths.
```

## Prompt M0 — Scaffold

```
Execute milestone M0 from docs/09-build-plan.md.
- Create the Next.js 15 App Router + TypeScript (strict) + Tailwind project in the current repo root without overwriting CLAUDE.md, docs/ or fixtures/.
- Add shadcn/ui, drizzle-orm + drizzle-kit + postgres driver, zod, p-limit, vitest, @anthropic-ai/sdk, eslint/prettier.
- Implement lib/types.ts from docs/04-data-model.md, lib/db/schema.ts (all tables), lib/db/client.ts, npm scripts listed in CLAUDE.md (stub those not yet implementable).
- Create .env.example (copy from the one in the pack), .gitignore (include .env.local), GET /api/health, and docs/PROGRESS.md.
- Add lib/demo/fixtures.ts to load and type fixtures/demo-companies.json.
Run typecheck, lint, tests. Summarize what you did and any decisions. Commit.
```

## Prompt M1 — Demo-mode vertical slice

```
Execute milestone M1.
1) lib/identifiers: gstin.ts (format, state table, checksum, PAN/state/entity-type derivation per FR-1.2), pan.ts, cin.ts, udyam validation, names.ts (normalisation + token-set similarity per docs/07). Write vitest tests including AC-1 and the fixture GSTINs.
2) lib/scoring: rules.ts, score.ts, grades.ts implementing docs/07 EXACTLY, with unit tests for every rule/boundary/group/cap/hard stop/coverage. Verify the fixture results match fixtures/score_reference.py (97/A, 66/C, 38/D after change, 9/D).
3) lib/adapters/types.ts, schemas.ts (zod for every adapter output in docs/06), registry.ts, and a replay wrapper that serves fixtures with simulated 1–6s timing and isReplay=true.
4) lib/orchestrator: runCase.ts with parallelism, timeout, retry, failure isolation (AC-3), event log + monotonic seq, coverage + scoring + template narrative.
5) API routes: POST/GET /api/cases, GET /api/cases/[id], GET /api/cases/[id]/stream (SSE with Last-Event-ID replay + heartbeat), GET /api/demo/companies.
6) UI: Home page (validation feedback, demo chips) and /cases/[id] run view (agent lanes + findings feed + score ring) following docs/08.
Acceptance: entering a demo GSTIN shows lanes progressing and findings streaming, final score matches fixtures, refresh mid-run restores state. Show me how to run it. Commit.
```

## Prompt M2 — TinyFish live (GST + News)

```
Execute milestone M2. First, fetch https://docs.tinyfish.ai and confirm the real API shapes for Agent (run-sse), Search, and Fetch. Update the "Verify" notes in docs/06-tinyfish-integration.md with what you find, then implement lib/tinyfish/client.ts exactly per the contract in docs/06 §1 (SSE parsing with unit tests using recorded sample chunks, abort support, error mapping, credits if available).
Then implement lib/adapters/gst.ts (Agent) and lib/adapters/news.ts (Search -> Fetch -> LLM classify per docs/06 §4.5 and §6), plus scripts/spike.ts (`npm run spike -- gst <GSTIN>`), per-adapter timeout/retry, a result cache, and captcha_blocked handling. Never attempt CAPTCHA bypass.
I (the human) will provide TINYFISH_API_KEY and ANTHROPIC_API_KEY in .env.local. Do not print keys. If a live portal flow fails, report exactly what happened (status, error, raw events) rather than faking output, and propose goal-prompt adjustments.
Acceptance: at least one adapter runs live end to end with schema-valid output; failures degrade to a visible lane state.
```

## Prompt M3 — Report experience

```
Execute milestone M3: the full report UI per docs/08 section 3.2 (verdict header with score ring/grade/recommendation/coverage and badges, summary card, category breakdown, findings with expandable evidence and rule explanation, sources panel with per-source retry), LLM narrative (lib/llm/narrative.ts) with FR-7 validation and deterministic template fallback, POST /api/cases/[id]/rerun, JSON export route. Handle loading, partial, and failed states. Show a provisional badge when coverage < 0.60 and a Replay badge for fixture data. Add tests for narrative validation (rejects unknown finding IDs / invented numbers).
```

## Prompt M4 — MCA + Legal (+ reconciliation)

```
Execute milestone M4. Implement lib/adapters/mca.ts and lib/adapters/legal.ts per docs/06 with matchConfidence logic (state/city/director overlap), store discovered directors on the subject, and add reconciliation rules BIZ-02/BIZ-03. Use the tiering results I give you: <paste spike table results>. For any adapter marked replay-only, serve it via the replay wrapper and make the UI say why. Add tests for name-collision handling (low confidence -> no penalty).
```

## Prompt M5 — Monitoring and alerts

```
Execute milestone M5 per FR-10 and docs/07 sections 5-6: watches/alerts routes, monitor runner (cheap adapters + carried-forward results), diff.ts with fingerprints and severity mapping, in-process scheduler (60s tick), POST /api/cron/monitor, POST /api/demo/simulate-change using fixture snapshot t1, Watchlist page, alert bell with unread badge and critical toast, alert detail with before/after. Tests for diff.ts. Acceptance AC-10: watch Sunrise (C) -> simulate change -> critical alert C -> D with GST-01 evidence and a before/after view, labelled Simulated.
```

## Prompt M6 — Polish and resilience

```
Execute milestone M6: print view and JSON export polish, accessibility pass (ARIA live region, keyboard nav, contrast), error/empty/loading states audit, rate limit on case creation, debug page, copy review against docs/08 section 5, demo polish checklist (docs/08 section 8), README with architecture diagram, TinyFish usage and limits. Run the full acceptance checklist at the end of docs/02-FRD.md and report pass/fail per item.
```

## Prompt M7 — Demo readiness

```
Prepare for the demo: add a "record last live run" capability if time allows (FR-12.3), verify replay mode works fully offline, create a script `npm run demo:check` that runs: health check, a demo-mode case for each fixture (asserting expected score/grade), and a simulated alert. Print a pass/fail table. Do not add features; fix bugs only.
```

---

## Handy ad-hoc prompts

- **Spec check:** "Compare the current implementation of <module> against docs/<file>. List deviations; do not change code yet."
- **Adapter debug:** "Run `npm run spike -- <adapter> <id>`, show raw events and zod errors, and propose a goal-prompt revision. Do not mock data."
- **Review:** "Review the diff for violations of the non-negotiable rules in CLAUDE.md (fabricated data, missing evidence, scoring in LLM, secrets, un-labelled fixtures)."
- **Refactor safely:** "Before refactoring, ensure tests cover the behaviour; keep scoring results identical on fixtures."
- **Docs sync:** "Update docs/PROGRESS.md and any doc that no longer matches the code; list the changes."
