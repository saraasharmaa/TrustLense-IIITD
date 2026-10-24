# TrustLens — Project Pack

**Live due-diligence and credit-risk agent for MSME lending**, built for **HackIIITD 2026** (powered by TinyFish). "TrustLens" is a placeholder name; rename freely.

Enter a GSTIN, CIN or company name. TinyFish web agents check GST, MCA, courts/insolvency, Udyam, regulatory lists and the open web in parallel, and produce an explainable, evidence-backed risk report. Watched companies are re-checked and alert on change.

## What is in this pack

| File | Purpose |
|---|---|
| `CLAUDE.md` | Instructions Claude Code reads first: stack, rules, commands, work protocol |
| `docs/00-vision.md` | Vision, problem, users, principles, business model, roadmap |
| `docs/01-PRD.md` | Product requirements, personas, user stories, scope and cut lines |
| `docs/02-FRD.md` | Functional requirements with acceptance criteria and error matrix |
| `docs/03-architecture.md` | System design, components, flows, decisions |
| `docs/04-data-model.md` | Tables and shared zod/TS types |
| `docs/05-api-spec.md` | REST + SSE contract |
| `docs/06-tinyfish-integration.md` | TinyFish client, adapters, goal prompts, schemas, spike checklist |
| `docs/07-scoring-spec.md` | Deterministic scoring rules v1.0.0 |
| `docs/08-ui-ux-spec.md` | Screens, tokens, states, accessibility |
| `docs/09-build-plan.md` | 24-hour plan, milestones M0–M7, cut lines, roles |
| `docs/10-demo-and-pitch.md` | Round 1 deck content, demo script, judge Q&A |
| `docs/11-risks-compliance.md` | Risk register, ethics, regulatory checklist |
| `docs/12-claude-code-prompts.md` | Copy-paste prompts per milestone |
| `docs/PROGRESS.md` | Living status log |
| `fixtures/demo-companies.json` | 3 synthetic companies + a monitoring change snapshot |
| `fixtures/score_reference.py` | Reference scorer (run it to see expected results) |
| `.env.example` | Environment variables |

## How to use

1. **Round 1 (online):** use `docs/00`, `01`, `03`, `06`, `10` to write the 8–9 slide deck. **Do not submit code** (the brief says it may cost marks).
2. **Before the finale:** create TinyFish accounts, test portal flows manually in the TinyFish playground, fill the spike table in `docs/PROGRESS.md`, and **ask the organisers if pre-written code is allowed**.
3. **At the finale:** unzip into an empty git repo, run `claude`, paste prompts from `docs/12-claude-code-prompts.md` one milestone at a time.

## Things to verify (flagged in the docs)

- TinyFish API shapes (Agent request body, Search/Fetch endpoints, event format): check https://docs.tinyfish.ai.
- Which government portal flows work without CAPTCHA/OTP. The design degrades gracefully, but the demo plan depends on the spike.
- Market statistics for the deck: cite sources, don't use unsourced numbers.
- Legal/regulatory points in `docs/11-risks-compliance.md`: get qualified review before production.

## Backend: agents, orchestrator and API

How a check runs, from a request to a scored report.

```
POST /api/cases ─► createCase (validate ids, reuse subject) ─► runCase (in process)
                                                          │
        ┌────────────── adapters in parallel (p-limit) ───┴─ timeout, one retry, failure isolated
        │   gst · news · mca · legal · udyam* · regulatory*      (* no live adapter yet: reported as skipped)
        ▼
  source_runs + case_events (ordered log) ─► SSE /api/cases/:id/stream (replays from Last-Event-ID)
        ▼
  lib/scoring (deterministic) ─► narrative (LLM, validated, template fallback) ─► report
```

**How TinyFish is used.** `lib/tinyfish/client.ts` is the only code that calls TinyFish.
- *Agent* (`run-sse`): multi-step portal flows. GST, MCA and the Legal adapter (eCourts and IBBI) send a goal with a fixed safety preamble and validate the result with zod.
- *Search* and *Fetch*: the News adapter searches the web, fetches each article as markdown, and has Claude classify it. Claude never touches a score; it only classifies articles and words the narrative from findings.
- A CAPTCHA or blocked site is recorded as `captcha_blocked`. There is no bypass.

**What the report shows honestly.**
- Every source ends as `succeeded`, `not_found`, `captcha_blocked`, `failed`, `timeout`, `skipped` or `carried_forward`. A blocked or failed source lowers coverage; it is never filled in.
- Demo mode serves fixtures as labelled replay (`isReplay`, evidence URLs under `example.invalid/replay/`). Never present them as live.
- Live adapters have **not** been verified against the real portals yet (see the spike table in `docs/PROGRESS.md`).

### Run it
```bash
cp .env.example .env.local        # add DATABASE_URL, TINYFISH_API_KEY, ANTHROPIC_API_KEY
npm install
npm run db:push && npm run db:seed
npm run demo                      # replay mode, no keys needed beyond DATABASE_URL
npm run demo:check                # fixtures vs expected scores + the simulated alert
npm run spike -- gst <GSTIN> --runs 3
npm run spike -- news "<company name>"
```
`npm test` runs everything; database tests are skipped unless `DATABASE_URL` is set.

### API at a glance (contract in `docs/05-api-spec.md`)
| Route | Purpose |
|---|---|
| `POST /api/cases`, `GET /api/cases`, `GET /api/cases/:id` | start, list, read a case |
| `GET /api/cases/:id/stream` | SSE with replay from `Last-Event-ID` and 15 s heartbeat |
| `POST /api/cases/:id/rerun` | rerun failed or chosen sources in place |
| `GET /api/cases/:id/export?format=json` | downloadable report |
| `POST /api/cases/:id/watch`, `GET/PATCH /api/watches` | monitoring |
| `GET /api/alerts`, `POST /api/alerts/:id/ack` | alerts |
| `POST /api/cron/monitor` | due watches (bearer `CRON_SECRET`); an in-process scheduler also ticks every 60 s |
| `POST /api/demo/simulate-change` | replay fixture snapshot `t1` for a watch (demo mode only) |
| `GET /api/demo/companies`, `GET /api/health` | demo chips, health |

Dev only: `/debug/cases/:id` shows raw runs, steps, errors and events. Case creation is limited to 10 per minute per IP.

## Check the scoring reference

```
python3 fixtures/score_reference.py
```
Expected: Aravali 97/A, Sunrise 66/C (38/D after simulated change), Kaveri 9/D.

All companies, identifiers, cases and articles in `fixtures/` are **synthetic**.
