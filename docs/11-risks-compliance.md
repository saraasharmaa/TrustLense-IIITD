# 11 — Risks, Compliance and Ethics

> This is a planning aid, not legal advice. Get qualified legal review before any production use.

## 1. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Portal flows blocked by CAPTCHA/OTP | High | High | Spike early; adapter tiers; `captcha_blocked` state; replay fallback labelled honestly; no bypass |
| R2 | Portal layout/URL changes break extraction | Medium | Medium | Goal-based agent not selectors; zod validation; visible failures; adapter-level retries |
| R3 | Slow/unreliable network at venue | Medium | High | Hotspot backup, local DB, replay mode, pre-warmed cache, backup video |
| R4 | TinyFish credits or rate limits exhausted | Medium | High | Cache, cheap adapters first, monitoring uses only `gst` + `news`, usage checks, ask mentors for limits |
| R5 | Wrong-company match (name collisions) | Medium | High | Match confidence, director/state/city overlap, no penalty under 0.7, human review |
| R6 | LLM hallucination in narrative | Medium | High | Findings-only input, citations validated, deterministic fallback, no scoring role |
| R7 | Prompt injection from web content | Medium | Medium | Page text treated as data; delimiters; classification output schema-validated; tool-less LLM calls |
| R8 | Scope creep in 24h | High | High | Binding cut lines in `09`; vertical slice first |
| R9 | Demo failure | Medium | High | Two rehearsals, replay mode, recorded video |
| R10 | Misrepresenting demo data as live | Low | Critical | Mandatory visible badges; synthetic fixtures labelled; script says so |
| R11 | Legal/ToS concerns scraping government portals | Medium | High | Public data only, no access-control circumvention, rate-limited, respect robots/ToS where applicable; position licensed APIs as production tier |
| R12 | Secrets leaked in repo/slides | Low | High | `.env.local` git-ignored, no keys in docs, rotate if exposed |
| R13 | Pre-built code rule violation | Low | High | Ask organisers; start coding at kickoff unless confirmed |

## 2. Responsible-data principles

- **Public sources only.** No logins, paywalls, OTP flows, or private data.
- **No circumvention.** No CAPTCHA solvers, no evasion of rate limits or blocks. Stealth/proxy profile options are for legitimately public, geo-restricted or bot-filtered pages, not for defeating access controls. Check each target's terms and be conservative.
- **Minimal personal data.** Business entities are the subject. Director names appear only where publicly listed and are used solely for disambiguation and disqualification checks. Don't store more than needed; no individual consumer scoring.
- **Purpose limitation and disclosure.** The tool states its purpose (business due diligence) and the disclaimers on every report.
- **Accuracy and redress.** Show source and timestamp for every claim; allow re-run; roadmap includes a borrower dispute/correction flow.
- **Human decision.** Output is a recommendation with reasons. Never auto-reject.

## 3. Indian regulatory considerations to review before production

- **DPDP Act, 2023:** director/individual names are personal data; define lawful basis, purpose, retention, and rights handling.
- **Credit information regulation:** the Credit Information Companies (Regulation) Act, 2005 governs credit information businesses in India. Confirm with counsel whether any production feature (especially aggregating and distributing credit-relevant information about entities or individuals) could fall within it. The hackathon MVP is a decision-support prototype over public data, not a credit bureau.
- **Website terms and IT Act:** review the terms of each source; prefer official/licensed channels in production.
- **RBI guidelines** on digital lending and outsourcing may apply to lender customers; they will care about auditability, data localisation and vendor risk.
Mark all of the above as **to verify** in any claims you make.

## 4. Safe-demo practices

- Use **synthetic companies** (provided) for scripted scenarios, and well-known **public** identifiers only for live spikes. Don't run live checks on private individuals or small businesses without consent.
- Label simulated alerts as simulated and replay data as replay, always.
- Don't claim accuracy, coverage, or production readiness you have not measured.

## 5. Quality and evaluation plan (post-MVP)

- Gold set of ~50 entities with manually verified facts → measure extraction accuracy per adapter.
- Track analyst feedback (finding accepted/rejected) → false-flag rate.
- Monitor adapter success rate, latency and cost over time; alert on drift.
- Red-team the news classifier with same-name distractors and injected instructions.
