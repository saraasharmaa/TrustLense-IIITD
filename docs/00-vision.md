# 00 — Vision Document

**Product:** TrustLens (placeholder name) — live due-diligence and credit-risk agent for MSME lending
**Event:** HackIIITD 2026 (Esya '26, IIIT Delhi), powered by TinyFish
**Version:** 1.0

---

## 1. One-line vision

> Make verifying any Indian MSME as fast, cheap and trustworthy as checking a balance, by turning the fragmented public web into a live, explainable credit-risk signal.

## 2. The problem

Lending to or onboarding a small business in India means checking many disconnected public sources: GST registration and filing status, MCA company records, court and insolvency cases, Udyam registration, regulator orders and news. Each lives on a different portal with its own interface. Many have no clean API, so analysts open tab after tab and copy facts into a spreadsheet.

Consequences:
- **Slow:** hours to days per borrower or vendor.
- **Expensive for small lenders:** NBFCs, fintech lenders and co-operative banks cannot afford large diligence teams, so small businesses get rejected or overpriced.
- **Inconsistent:** two analysts check different things and reach different conclusions.
- **Stale:** a check done at onboarding says nothing about the borrower six months later, when GST filings stop or a case is filed.
- **Unauditable:** findings sit in someone's notes, not tied to a source and a timestamp.

> Add sourced figures before Round 1: MSME count, credit gap, share of MSMEs lacking formal credit (e.g. Ministry of MSME annual report, RBI, IFC). **[VERIFY and cite each number; do not use unsourced stats in the deck.]**

## 3. Our solution

Enter a GSTIN, CIN or name. TrustLens runs specialised web agents in parallel across public sources, normalises what they find into **findings with evidence**, scores them with a **transparent rule engine**, and presents a **report** a credit officer can trust and audit in minutes. Then it **keeps watching**: when a watched company's GST status flips, a case is filed or adverse news appears, an alert fires with what changed.

### Why a web agent (and why TinyFish)

These sources are websites, not APIs. Scrapers break whenever a portal changes. TinyFish's agent takes a natural-language goal, navigates multi-step flows and returns structured data, and its Search, Fetch and Browser APIs let us escalate from cheap to heavy retrieval as needed. The agent is the product's engine, not a decoration.

## 4. Who it is for

| Segment | Need | Value |
|---|---|---|
| **Primary: NBFCs, fintech lenders, co-op banks** (credit analysts, risk managers) | Fast, consistent borrower vetting and ongoing monitoring | Hours → minutes, auditable, early-warning |
| **Secondary: B2B marketplaces, supply-chain finance, procurement teams** | Vendor / buyer risk checks at onboarding and during contracts | Fewer defaults and fraud, continuous vendor monitoring |
| **Future: MSMEs themselves** | A verified, shareable profile and the chance to correct errors | Faster credit access, fairer treatment |

## 5. Product principles

1. **Evidence over opinion.** Every claim links to a source, a timestamp and an excerpt.
2. **Transparent scoring.** Rules are visible, deterministic and explainable. AI explains; it never decides.
3. **Honest about uncertainty.** Show coverage (what we could and couldn't check) and confidence. A blocked source is shown as blocked, never filled in.
4. **Human in the loop.** The output is a recommendation for an analyst, not an automated rejection.
5. **Fast first value.** Results stream live; the analyst sees agents working and findings appearing within seconds.
6. **Continuous, not one-off.** Monitoring is part of the core loop, not an add-on.
7. **Responsible data use.** Public data only, no circumvention of access controls, purpose-limited, with clear disclaimers.

## 6. Differentiation

- **Live, not stored:** reads sources at query time instead of relying on stale scraped databases.
- **Explainable by design:** every point deducted maps to a named rule and evidence.
- **Adapter architecture:** each source is a pluggable adapter. Where a licensed API exists (e.g. through a data provider), it can slot in as a higher-trust adapter; the web agent covers the long tail and sources without APIs.
- **Monitoring with diffs:** alerts describe what changed and how the grade moved.

## 7. Business model (post-hackathon)

- **Per-report pricing** for ad-hoc checks (lowest tier).
- **Monitoring subscription** priced per watched entity per month.
- **API / embedded** for lenders and marketplaces integrating into their own workflows.
- **Enterprise:** custom adapters, SSO, audit exports, private deployment.

Unit economics hinge on agent cost per report. Mitigation: cache recent results, use Search/Fetch first and escalate to Agent only for hard pages, and run cheap monitoring adapters more often than heavy ones.

## 8. Roadmap

| Phase | Scope |
|---|---|
| **Hackathon MVP (24h)** | Single-entity check, 4–6 adapters, live progress stream, scored report with evidence, watch + simulated change alert, replay mode |
| **v1 (first 3 months)** | Auth + workspaces, portfolio dashboard, scheduled monitoring at scale, webhook/Slack/email alerts, PDF/JSON audit export, analyst notes and overrides |
| **v2** | Licensed-API adapters alongside agents, Account Aggregator / bank-statement cash-flow signals, sector benchmarks, borrower-side verified profile and dispute flow |
| **v3** | Network effects: anonymised cross-lender signals, configurable policy engines per lender, fully API-first platform |

## 9. Success metrics

**Hackathon:** a live end-to-end run on at least 3 adapters during the demo; report shows evidence and coverage; alert flow demonstrable; judges can state what TinyFish does in the product.
**Product (post):** median time-to-report < 2 min; adapter success rate > 85%; analyst time per check down > 80% vs manual; false-flag rate (analyst-rejected findings) < 10%; monitoring alert precision > 80%.

## 10. Ethics and compliance posture

- Decision support only; final credit decisions stay with humans.
- Public information only; respects portal access controls (no CAPTCHA bypass, no login circumvention).
- Entity-match confidence is shown; ambiguous matches go to human review to avoid blaming the wrong company.
- Personal data (e.g. director names) handled minimally and purposefully; align with India's DPDP Act, 2023 before production. Consult counsel on whether any production feature could be treated as credit-information activity regulated in India. See `11-risks-compliance.md`.

## 11. Vision statement for the pitch

*Every small business deserves a fair, fast credit decision, and every lender deserves to trust what they see. TrustLens turns the scattered public record into live, evidence-backed risk intelligence, and never stops watching.*
