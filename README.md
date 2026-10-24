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

## Check the scoring reference

```
python3 fixtures/score_reference.py
```
Expected: Aravali 97/A, Sunrise 66/C (38/D after simulated change), Kaveri 9/D.

All companies, identifiers, cases and articles in `fixtures/` are **synthetic**.
