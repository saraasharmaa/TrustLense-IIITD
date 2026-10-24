# 05 — API Specification (REST + SSE)

Base: `/api`. JSON in/out. No auth in MVP (single demo workspace). All inputs zod-validated.

## Error shape

```json
{ "error": { "code": "invalid_identifier", "message": "GSTIN checksum is invalid", "details": { "check": "checksum" } } }
```
Codes: `invalid_input`, `invalid_identifier`, `not_found`, `rate_limited`, `conflict`, `upstream_unavailable`, `internal`. HTTP: 400, 404, 409, 429, 502, 500.

## Resolve

### `POST /api/resolve`
Req: `{ "query": "Sunrise Textiles Tiruppur" }`
Res 200:
```json
{ "candidates": [
  { "legalName": "…", "gstin": "33AABCS7345M1Z3", "cin": null, "state": "Tamil Nadu", "city": "Tiruppur",
    "confidence": 0.82, "sourceUrl": "https://…" } ] }
```

## Cases

### `POST /api/cases`
Req:
```json
{ "gstin": "33AABCS7345M1Z3", "cin": null, "udyamNumber": null,
  "legalName": "Sunrise Textiles Pvt Ltd", "sources": ["gst","news","mca","legal"],
  "mode": "live", "fresh": false, "watch": null }
```
Rules: at least one of `gstin|cin|udyamNumber`. `legalName` optional if GSTIN given (adapters discover it), required for news disambiguation when known. `mode` defaults to server `DEMO_MODE`. If the GSTIN matches a fixture and `mode="demo"`, replay is used.
Res 201: `{ "caseId": "uuid", "subjectId": "uuid", "status": "queued" }`

### `GET /api/cases`
Query: `limit` (default 20), `subjectId?`. Res: `{ "cases": [CaseSummary] }`

### `GET /api/cases/:id`
Res 200:
```json
{
  "id": "uuid", "status": "completed|partial|running|queued|failed", "mode": "live|demo", "version": 1,
  "subject": { "legalName": "…", "gstin": "…", "pan": "…", "cin": "…", "udyamNumber": "…", "state": "Tamil Nadu", "entityType": "Company" },
  "score": 66, "grade": "C", "recommendation": "Manual review required",
  "coverage": 1.0, "isProvisional": false, "hardStops": [],
  "categoryBreakdown": [ { "category": "STATUTORY", "cap": 30, "applied": 8 } ],
  "narrative": { "headline": "…", "summary": "…", "keyRisks": [], "strengths": [], "suggestedConditions": [], "questionsForBorrower": [], "source": "llm" },
  "sourceRuns": [ { "id": "uuid", "adapter": "gst", "status": "succeeded", "isReplay": false, "durationMs": 21400, "attempt": 1, "error": null } ],
  "findings": [ { "id": "…", "ruleId": "GST-03", "category": "STATUTORY", "severity": "medium", "title": "…", "detail": "…", "appliedPenalty": 8, "hardStop": false, "confidence": 1, "evidence": [ { "url": "…", "retrievedAt": "…", "excerpt": "…", "adapter": "gst", "isReplay": false } ] } ],
  "rulesVersion": "1.0.0", "startedAt": "…", "completedAt": "…",
  "watch": { "id": "uuid", "frequencyHours": 24, "active": true } 
}
```
Results while running return the partial state computed so far (`score: null`).

### `GET /api/cases/:id/stream` (SSE)
Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Honors `Last-Event-ID`. Each message:
```
id: 12
event: source.progress
data: {"seq":12,"type":"source.progress","ts":"…","data":{"adapter":"gst","text":"Opening GST taxpayer search","url":"https://…"}}
```
Event `data` payloads:

| type | data |
|---|---|
| `case.started` | `{ caseId, adapters: string[], mode }` |
| `source.started` | `{ adapter, attempt, isReplay }` |
| `source.progress` | `{ adapter, text, url? }` (throttled) |
| `source.completed` | `{ adapter, status, durationMs, summary }` (summary: one-line human text) |
| `source.failed` | `{ adapter, status, error, willRetry }` |
| `finding.created` | `Finding` (full object) |
| `score.computed` | `ScoreResult` |
| `narrative.ready` | `Narrative` |
| `report.ready` | `{ caseId, status }` |
| `case.failed` | `{ message }` |

Heartbeat: `: ping` every 15 s. Stream ends after `report.ready` / `case.failed`.

### `POST /api/cases/:id/rerun`
Req: `{ "sources": ["gst"] }` (omit = all failed). Res 202: `{ "caseId": "uuid", "version": 2 }` (same case, new report version, stream continues from the new events).

### `GET /api/cases/:id/export?format=json`
Returns the report as a downloadable JSON (`Content-Disposition: attachment`). Print view is the page `/cases/:id/print`.

## Watches and alerts

### `POST /api/cases/:id/watch`
Req: `{ "frequencyHours": 24, "adapters": ["gst","news"] }` → 201 `{ "watchId": "uuid", "nextRunAt": "…" }`. Duplicate active watch for the subject → 409.

### `GET /api/watches`
Res: `{ "watches": [ { "id", "subject": {…}, "frequencyHours", "active", "lastRunAt", "nextRunAt", "currentGrade", "baselineGrade" } ] }`

### `PATCH /api/watches/:id` — `{ "active": false }` or `{ "frequencyHours": 6 }`

### `GET /api/alerts`
Query: `unread=1`, `limit`. Res: `{ "unreadCount": 2, "alerts": [ { "id", "severity", "title", "isSimulated", "createdAt", "acknowledgedAt", "subject": {…}, "change": { "gradeBefore": "C", "gradeAfter": "D", "scoreBefore": 66, "scoreAfter": 38, "newFindings": [ { "ruleId": "GST-01", "title": "…" } ], "resolvedFindings": [], "hardStopAppeared": true }, "caseId", "previousCaseId" } ] }`

### `POST /api/alerts/:id/ack` → 204

### `POST /api/cron/monitor`
Header `Authorization: Bearer $CRON_SECRET`. Runs due watches. Res: `{ "ran": 3, "alerts": 1 }`.

### `POST /api/demo/simulate-change`
Req: `{ "watchId": "uuid" }`. Only enabled when `DEMO_MODE=true` or `ALLOW_SIMULATION=true`. Runs the monitoring pipeline using fixture snapshot `t1` for the watch's subject; creates an alert flagged `isSimulated`. Res 201: `{ "alertId": "uuid", "caseId": "uuid" }`. 404 if the subject has no `t1` snapshot.

## Misc

### `GET /api/health`
`{ "ok": true, "db": true, "tinyfishConfigured": true, "llmConfigured": true, "demoMode": false, "version": "0.1.0" }`

### `GET /api/demo/companies`
Returns fixture companies (name, GSTIN, tagline, expected grade) for the "Try a demo company" chips.

## Conventions
- IDs are UUID strings. Timestamps ISO-8601 UTC. Money integer INR.
- Idempotency: `POST /api/cases` accepts optional header `Idempotency-Key` (dedupe within 60 s).
- Pagination: `limit` + `cursor` (opaque) where lists can grow (`/cases`, `/alerts`).
