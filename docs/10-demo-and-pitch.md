# 10 — Demo and Pitch

## 1. Round 1: online deck (8–9 slides, PPT/PDF on Unstop)

Round 1 is scored out of 25 marks and wants: team details, problem statement, proposed solution, target users, technical architecture and stack, **how you plan to integrate TinyFish**, scalability/feasibility/use case, MVP/prototype (optional). **Do not submit code or deployed links** (the brief says it may cost marks). A Figma/UI prototype is optional; static mockups are enough.

| # | Slide | Content to write |
|---|---|---|
| 1 | **Title + team** | TrustLens: live due-diligence and credit-risk agent for MSME lending. Team names, colleges, roles, one-line pitch. |
| 2 | **Problem** | An analyst opens 5–8 portals per borrower: GST, MCA, courts, Udyam, news. Slow, inconsistent, stale, unauditable. Small lenders can't afford it → MSMEs rejected or overpriced. Add 2–3 **sourced** numbers (MSME count, credit gap, check time). Mark each with its source. |
| 3 | **Solution** | Enter a GSTIN → parallel web agents → evidence-backed risk report in minutes → continuous monitoring with change alerts. Show the 4-step flow as a graphic. |
| 4 | **Target users and value** | NBFCs/fintech lenders/co-op banks; B2B marketplaces and procurement teams; later MSMEs. Before/after: hours → minutes; early-warning. |
| 5 | **Product walkthrough** | 3 mockups: live agent lanes, report with score and evidence, alert with before/after. |
| 6 | **Architecture and stack** | Diagram from `03-architecture.md`: Next.js/TS, Postgres, orchestrator, adapters, scoring engine, LLM narrative, SSE. Emphasise deterministic scoring + AI explanation. |
| 7 | **TinyFish integration (the core slide)** | Table: Search → discover/resolve entities and adverse news; Fetch → render articles/pages; **Agent** → multi-step portal flows (GST, MCA, courts); Browser → sessions for harder flows (stretch). Why no API/scraper works: sources are forms and portals that change; agents adapt. Escalation loop and cost control. Failure handling: CAPTCHA → degrade gracefully, never bypass. |
| 8 | **Scalability, feasibility, business model** | Adapter architecture (add a source = one file); licensed-API adapters later; caching and tiered cost; pricing: per-report, monitoring subscription, API; roadmap. Feasibility: spike results (which portal flows we tested). |
| 9 | **Roadmap + ask** | Hackathon MVP scope (what we'll build in 24h), v1, v2. Why us: fintech background. |

Tips: one idea per slide, big visuals, no walls of text; state assumptions and limits openly (judges reward credibility); put the TinyFish slide where it can't be missed; export to PDF; keep to ≤ 9 slides.

## 2. Finale demo script (4 minutes)

**Setup:** laptop on projector, app open at Home, demo banner off if live, hotspot ready, backup video queued, Sunrise already watched in a second tab.

| Time | Action | Say |
|---|---|---|
| 0:00 | Hook | "Meera is a credit analyst. Before she lends ₹25 lakh to a Tiruppur textile unit she opens eight portals. We do it in two minutes — and keep watching afterwards." |
| 0:20 | Enter GSTIN (Sunrise) → Run | "TinyFish agents are now visiting the GST portal, courts and news in parallel." |
| 0:30–1:30 | Lanes + findings stream | Narrate real activity: "this agent is navigating the GST search form"; point at a blocked/slow lane if any: "We never bypass CAPTCHAs; coverage drops and the report says so." |
| 1:30 | Report | "66, grade C, manual review. Not a black box: every point is a rule." |
| 1:50 | Open a finding → evidence | "−12 for a pending cheque-dishonour case, with the source and timestamp." |
| 2:15 | Coverage + sources | "4 of 5 areas verified. Provisional labels appear if coverage is low." |
| 2:30 | Watchlist → Simulate change | "Three days later…" (clearly labelled *Simulated*) → critical alert toast. |
| 3:00 | Alert detail | "GST suspended → hard stop, grade C → D, before/after, with the new evidence." |
| 3:20 | Architecture slide | "Adapters per source; TinyFish Search → Fetch → Agent escalation; deterministic scoring; AI writes the summary only." |
| 3:40 | Business + close | "Per-report and monitoring subscriptions for NBFCs, marketplaces; licensed APIs plug into the same adapters." |

**If live fails:** switch to Replay mode and say so: "Portals are slow on this network, here's a recorded run" (the app labels it). Never pass replay off as live.

**Rehearse:** twice end to end, once with the network off (replay only).

## 3. Judging criteria mapping

| Criterion (from event brief) | Our evidence |
|---|---|
| Execution | Working vertical slice, tests, live adapters, polished UI states |
| Innovation | Live evidence-backed diligence + monitoring with diffs; agents as the data layer |
| Scalability | Adapter registry, caching, tiered cost, queue-ready event log, licensed-API tier |
| TinyFish API usage | Search + Fetch + Agent (+ Browser stretch) in distinct, necessary roles; escalation loop; credits tracked |
| Overall impact | Faster, fairer MSME credit access; early-warning reduces defaults |

## 4. Likely judge questions and answers

1. **Why not just use official APIs?** Many sources have none or limited coverage; agents cover the long tail and survive layout changes. Where licensed APIs exist, they become higher-trust adapters behind the same interface.
2. **What about CAPTCHAs and blocking?** We don't bypass them. The lane shows "Blocked", coverage drops, and the report is marked provisional. Alternatives: other public sources, retry, or licensed data in production.
3. **How do you avoid blaming the wrong company with the same name?** Entity-match confidence from state/city/directors; low confidence → "possible match", no penalty, human review.
4. **Is the AI deciding?** No. Scoring is deterministic and unit-tested; AI classifies news and writes the summary from findings and cites IDs. Humans decide.
5. **Cost per report?** Cheap-first escalation (Search/Fetch before Agent), caching, and lighter monitoring runs. We track credits per run. (Quote measured numbers from your spike.)
6. **Legal/ToS?** Public data only, no login or access-control circumvention, purpose-limited, DPDP-aware; decision support not a credit bureau. Counsel review before production.
7. **What if a portal changes?** The agent works from the goal, not selectors; schema validation catches drift and fails visibly.
8. **How does it scale to 10,000 watched companies?** Move orchestration to a queue (the DB event log makes that a swap), shard by adapter, tiered frequency, cache, and prioritise by risk grade.
9. **Accuracy?** Report evidence for every claim; track analyst-rejected findings as a metric; extraction validated by schema; known limits stated.

## 5. Mentor session asks

- "Which of these portal flows are reliable via the Agent API today?"
- "Best practice for Search → Fetch → Agent escalation and for cost control?"
- "How do stealth/proxy options relate to public government sites?"
- "Rate limits and parallelism limits for our key?"
- "What do judges from TinyFish most want to see in the integration?"

## 6. Submission checklist

- [ ] README: problem, architecture diagram, TinyFish usage, setup, demo instructions, limits
- [ ] Demo video (≤ 3 min) as backup
- [ ] Slides final (≤ 9) exported as PDF
- [ ] Repo clean, no secrets, `.env.example` present
- [ ] Synthetic data clearly labelled
