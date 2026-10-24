# 03 — Architecture

## 1. System overview

```
┌──────────────────────────── Browser (Next.js UI) ────────────────────────────┐
│ New check · Live run (SSE) · Report · Watchlist · Alerts · Print view        │
└───────────────┬───────────────────────────────────────────▲──────────────────┘
                │ REST (JSON)                               │ SSE (case events)
┌───────────────▼───────────────────────────────────────────┴──────────────────┐
│                       Next.js server (Node runtime)                          │
│  API routes ─► Orchestrator ─► Adapter registry ─► [gst|mca|legal|news|...]  │
│                    │                 │                     │                 │
│                    │                 └─► lib/tinyfish/client ──► TinyFish    │
│                    │                          (Search · Fetch · Agent · Browser)
│                    ├─► Normalise ─► Scoring engine (deterministic)           │
│                    ├─► LLM (news classify, narrative)  ─► Anthropic API      │
│                    ├─► Event log (DB) ─► SSE fan-out                         │
│                    └─► Monitor scheduler ─► Diff ─► Alerts                   │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                         Postgres (Drizzle)
```

## 2. Components

| Component | Responsibility |
|---|---|
| **API routes** (`app/api/**`) | Validate input (zod), call `lib/*`, shape responses. No business logic. |
| **Orchestrator** (`lib/orchestrator`) | Runs a case: choose adapters, parallelise with `p-limit`, timeouts, retry, emits events, persists, triggers scoring + narrative. |
| **Adapter registry** (`lib/adapters`) | Each portal/source is an isolated `SourceAdapter`. Returns typed normalised data and raw output. |
| **TinyFish client** (`lib/tinyfish`) | Only place that talks to TinyFish. Handles auth header, SSE parsing, progress callbacks, abort, error mapping. |
| **Scoring engine** (`lib/scoring`) | Pure functions: normalised data → findings → score/grade/recommendation. Fully unit-tested. |
| **LLM layer** (`lib/llm`) | News article classification (with entity disambiguation) and narrative. Schema-validated, with deterministic fallbacks. |
| **Event log + SSE** | Every state change is a `case_events` row; SSE route replays + live-tails. Survives refresh. |
| **Monitor** (`lib/monitor`) | Due-watch selection, monitoring run, snapshot diff, alert creation. |
| **Demo layer** (`lib/demo`) | Fixture loading and replay with simulated timing; flags results as replay. |

## 3. Tech stack and rationale

| Choice | Why |
|---|---|
| Next.js 15 + TS | One codebase for UI and API; fast to build; strong typing end to end |
| Persistent Node host | Agent runs last up to ~2 min and stream via SSE; avoids serverless time limits |
| Postgres + Drizzle | Durable event log and JSONB for raw outputs; typed schema |
| zod | Contract at every boundary (TinyFish, LLM, API) |
| SSE (not WebSocket) | One-way event stream; simple, proxy-friendly, native `EventSource` reconnect with `Last-Event-ID` |
| In-process orchestration | Fastest to build for a hackathon; the DB event log makes a later move to a queue (BullMQ, Temporal) straightforward |
| Anthropic API | Narrative + classification; model via env |

## 4. Case execution sequence

```
User → POST /api/cases ─► create subject+case (queued) ─► 201 {caseId}
UI   → GET  /api/cases/:id/stream (SSE)  ◄── replay + live events
Orchestrator.runCase(caseId):
  emit case.started
  adapters = select(requested, inputs)
  parallel (limit N, timeout T, retry 1):
     emit source.started
     adapter.run() ─► TinyFish stream ─► emit source.progress*
     validate(zod) ─► persist source_run ─► emit source.completed|failed
  findings = scoring.evaluate(normalizedBySource)      # emit finding.created*
  report   = scoring.score(findings, coverage)          # emit score.computed
  narrative= llm.narrative(report) | template           # emit narrative.ready
  persist; emit report.ready; case.status = completed|partial|failed
```

## 5. Escalation loop (TinyFish usage)

Prefer cheap before heavy, per adapter:
1. **Search** to discover the right page or candidate entities.
2. **Fetch** to render and extract static or semi-static pages (news articles, company websites).
3. **Agent** for multi-step portal flows (GST, MCA, eCourts search forms).
4. **Browser** only if we must drive a session ourselves (stretch).
Use stealth/proxy profile options only where the target is geo-restricted or heavily bot-filtered *and* access is public; never to defeat access controls.

## 6. Concurrency, timeouts, retries

- `MAX_PARALLEL_ADAPTERS=6`, per-adapter `ADAPTER_TIMEOUT_MS=90000`, case cap `CASE_TIMEOUT_MS=180000`.
- Retry once on `failed`/`timeout`, backoff 2s; never on `captcha_blocked`/`not_found`.
- `AbortController` threaded through client → SSE read; abort on timeout.
- Result cache keyed `adapter:identifier` with TTL (default 10 min) to protect credits during development and demos. Bypass with `?fresh=1`.

## 7. Events

Types: `case.started`, `source.started`, `source.progress`, `source.completed`, `source.failed`, `finding.created`, `score.computed`, `narrative.ready`, `report.ready`, `case.failed`, `alert.created`. Payload shapes in `05-api-spec.md`. Every event: `{seq, type, ts, data}`.

## 8. Deployment

- **Local (primary for the finale):** `npm run build && npm start` on a team laptop with Neon or local Postgres. Works on venue Wi-Fi; keep a mobile hotspot as backup.
- **Hosted (optional):** Railway/Render/Fly with a persistent Node instance; set env vars; run `db:push`.
- Health: `GET /api/health` → `{ok, db, tinyfish: configured, llm: configured, demoMode}`.

## 9. Security

- Keys only server-side (`TINYFISH_API_KEY`, `ANTHROPIC_API_KEY`); never exposed to the client or logs.
- zod validation on all input; identifier sanitisation; parameterised queries via Drizzle.
- Evidence excerpts are rendered as text (no HTML injection); links `rel="noopener noreferrer"`.
- Untrusted web content (portal pages, articles) is data, never instructions: the LLM prompts delimit content and instruct the model to ignore instructions inside it; TinyFish goals do not include page-derived text as commands.
- Per-IP rate limit on case creation; CRON endpoint requires bearer secret.

## 10. Observability

Structured JSON logs; each `source_run` stores duration, attempts, TinyFish run id and error; a hidden `/debug/cases/:id` page (dev only) shows raw adapter output and events.

## 11. Decision records (short)

| # | Decision | Alternatives rejected | Reason |
|---|---|---|---|
| D1 | Deterministic scoring, LLM only explains | LLM-scored risk | Auditability and trust; testability |
| D2 | Adapter-per-source with common interface | One big agent prompt | Isolation, partial results, swappable with licensed APIs |
| D3 | DB-backed event log + SSE | In-memory only | Refresh/reconnect safety, replay, audit |
| D4 | Persistent Node host | Vercel serverless | Long runs + SSE |
| D5 | Replay mode as a first-class feature | Hope portals are up | Demo resilience, with honest labelling |
| D6 | No CAPTCHA bypass | Solver services | Ethics, ToS, legal risk; show graceful degradation instead |
