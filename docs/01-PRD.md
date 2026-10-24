# 01 — Product Requirements Document (PRD)

**Product:** TrustLens · **Scope:** Hackathon MVP (24h finale build) with post-event direction
**Priorities:** P0 = must ship, P1 = should ship, P2 = stretch

---

## 1. Goal

Let a credit analyst go from "I have a GSTIN" to "I understand this business's risk, with evidence" in under two minutes, and get alerted when that risk changes.

### Goals
- Live multi-source diligence with a streaming, watchable agent run.
- Explainable, deterministic risk score with evidence and coverage.
- Monitoring with change alerts.
- Make TinyFish central and visible.

### Non-goals (MVP)
- Automated approve/reject decisions.
- Credit bureau data (CIBIL etc.), bank statements, financial-statement analysis.
- Individual (consumer) credit scoring.
- Authentication, billing, multi-tenant admin.
- Mobile apps.

## 2. Personas

**Meera, credit analyst at an NBFC.** Vets 15–20 MSME loan applications a day. Wants one place to see compliance, legal and news signals, quickly, with sources she can cite in her credit note. Distrusts black-box scores.

**Rohan, vendor-risk manager at a B2B marketplace.** Onboards hundreds of sellers. Needs a fast check at onboarding and a heads-up if a seller deteriorates.

**Ishita, risk head (secondary).** Wants consistent, auditable checks and a portfolio view of who got worse this week.

## 3. User stories

| ID | Story | Pri |
|---|---|---|
| US-1 | As Meera, I enter a GSTIN and start a check so I don't open portals manually | P0 |
| US-2 | I can enter a company name, see candidate matches, and pick the right one | P1 |
| US-3 | I watch live progress per source (running / done / blocked) so I trust what's happening | P0 |
| US-4 | I see a risk score, grade and recommendation with a plain-language summary | P0 |
| US-5 | I see each finding with severity, the rule behind it, and the source evidence | P0 |
| US-6 | I see which sources succeeded or failed (coverage) and a provisional label when coverage is low | P0 |
| US-7 | I can re-run a single failed source without redoing everything | P1 |
| US-8 | I can add a company to a watchlist with a check frequency | P0 |
| US-9 | I get an alert showing what changed and how the grade moved | P0 |
| US-10 | I can export the report as JSON and print/PDF for the credit file | P1 |
| US-11 | I can see past checks for a company and compare snapshots over time | P1 |
| US-12 | As a presenter, I can run in clearly-labelled replay mode if portals are down | P0 |
| US-13 | I can add an analyst note to a finding or override-dismiss a false finding (with reason) | P2 |
| US-14 | A portfolio dashboard shows the grade distribution and recent alerts | P2 |

## 4. MVP scope

### In scope (P0/P1)
Adapters: **GST** (P0), **News/adverse media** (P0), **MCA** (P0), **Legal & insolvency** (P1), **Udyam** (P2), **Regulatory lists** (P2). Entity resolution by name (P1). Streaming run view, report, watch + alerts, replay mode, JSON export, print view.

### Cut lines (drop in this order if behind)
1. Regulatory adapter → 2. Udyam adapter → 3. PDF/print polish → 4. Case history compare → 5. Name-based resolution (GSTIN-only input) → 6. Slack/email alert delivery (in-app alerts only).
**Never cut:** GST + News adapters live, scoring engine, evidence + coverage display, streaming run view, watch + simulated alert, replay mode.

## 5. Key user flows

**Flow A — New check:** Home → enter GSTIN/CIN (or name → pick candidate) → Start → live run view (source lanes, findings appear) → report.
**Flow B — Review:** Report → scan score, grade, summary → expand findings → open evidence drawer → export.
**Flow C — Watch:** Report → "Watch this company" → choose frequency → later, alert appears (bell + Watchlist) → open diff view (before/after grade, new findings) → open new report.
**Flow D — Degraded:** A source is blocked → lane shows "Blocked (CAPTCHA)" → report shows reduced coverage and "Provisional" badge → analyst can retry that source or enter a manual value (P2).

## 6. Requirements (summary; detail in FRD)

| ID | Requirement | Pri |
|---|---|---|
| R-1 | Validate GSTIN (format + checksum), derive PAN, state and entity type locally | P0 |
| R-2 | Run adapters in parallel with timeouts, one retry, isolated failure | P0 |
| R-3 | Stream run progress to the browser via SSE with replay on reconnect | P0 |
| R-4 | Normalise all source output to typed findings with evidence | P0 |
| R-5 | Deterministic scoring per `07-scoring-spec.md`, with hard-stop flags | P0 |
| R-6 | Coverage and confidence shown; low coverage → provisional | P0 |
| R-7 | LLM narrative constrained to provided findings, schema-validated, with deterministic fallback | P0 |
| R-8 | Watchlist, scheduled re-check, diff, alerts | P0 |
| R-9 | Demo/replay mode with visible labelling | P0 |
| R-10 | JSON export + printable report | P1 |
| R-11 | Name → entity candidates via Search + LLM extraction, with confidence | P1 |

## 7. Non-functional requirements

- **Time-to-first-signal** < 5s (first lane shows activity); **full report** target < 120s typical, hard cap 180s with partial results.
- **Resilience:** one adapter failing never fails the case; partial reports are valid.
- **Reproducibility:** each report stores raw adapter output, normalised findings, rule versions.
- **Security:** no secrets in client; env-only keys; basic rate limit per IP on create-case; input sanitised.
- **Accessibility:** keyboard navigable, colour is never the only severity cue, WCAG AA contrast.
- **Observability:** structured logs per source run (duration, status, credits if available).
- **Cost control:** per-case adapter budget; cache identical source results within a configurable TTL (default 10 min live, none in demo).

## 8. Success metrics (hackathon)

- Demo completes live on ≥3 adapters (or honestly labelled replay) in under 4 minutes.
- Judges can answer: what does TinyFish do here, why can't an API replace it, what happens when a source fails.
- Every finding on screen has a visible source link.

## 9. Assumptions

- Target portals are publicly accessible for the specific lookups; some will present CAPTCHAs. (Validate in the spike, see `06`.)
- TinyFish credits from the event are sufficient for demo + development; we cache aggressively.
- Judges value an honest treatment of limits over claims of full automation.

## 10. Open questions (resolve during the spike)

1. Which portal lookups run reliably end-to-end via TinyFish Agent today (GST, MCA, eCourts, Udyam)? Which hit CAPTCHAs?
2. Typical latency and credit cost per adapter run?
3. Does the Search API surface good candidate matches for name resolution?
4. Is pre-event scaffolding code allowed by the organisers? (Confirm with the organisers before writing any code.)

## 11. Release criteria for the demo

All P0 stories pass acceptance criteria in `02-FRD.md`; typecheck/lint/tests green; demo rehearsed twice with live and replay paths; backup screen-recording exists.
