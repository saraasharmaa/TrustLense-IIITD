# 07 — Risk Scoring Specification (rules v1.0.0)

Deterministic. Implement in `lib/scoring/*` as pure functions: `evaluate(normalizedBySource, context) → Finding[]` and `score(findings, coverageInfo) → ScoreResult`. A reference implementation in Python (`fixtures/score_reference.py`) reproduces the fixture results; the TypeScript implementation MUST match it on all fixtures.

## 1. Model

Start at **100**. Each rule that triggers yields a **penalty**. Within a **rule group**, only the highest penalty applies. Within a **category**, applied penalties are summed and capped at the category's **cap**. `score = 100 − Σ(category applied)`.

| Category | Cap | Primary adapter |
|---|---|---|
| STATUTORY (GST compliance) | 30 | `gst` |
| CORPORATE (MCA standing) | 20 | `mca` |
| LEGAL (cases, insolvency) | 25 | `legal` |
| ADVERSE (news, regulatory) | 15 | `news` (+ `regulatory`) |
| LEGITIMACY (Udyam, consistency) | 10 | `udyam` |

Caps sum to 100. "Today" = `ctx.now` (fixtures: `demoToday` 2026-10-24).

## 2. Rules

`Hard stop` = forces grade D and a hard-stop recommendation regardless of score.

### STATUTORY
| Rule | Group | Condition | Severity | Penalty | Hard stop |
|---|---|---|---|---|---|
| GST-01 | G-STATUS | `registrationStatus` ∈ {Cancelled, Suspended} (case-insensitive) | critical | 30 | yes |
| GST-02 | G-FILING | `returns` available and the 3 most recent periods are all GSTR-3B `Not Filed` | high | 15 | no |
| GST-03 | G-FILING | `missed` = count of last-12 GSTR-3B `Not Filed`: ≥6 → 15 (high); ≥3 → 8 (medium). Else if `late` ≥ 4 → 4 (low) | high/medium/low | 15/8/4 | no |
| GST-04 | G-AGE | registered < 12 months before `now` | low | 4 | no |

`late` = filed after the due date (20th of the following month). If `returns` is empty/unavailable: GST-02/03 are **not evaluated** and a `COVERAGE-GST-RETURNS` info finding is created.

### CORPORATE
| Rule | Group | Condition | Severity | Penalty | Hard stop |
|---|---|---|---|---|---|
| MCA-01 | G-STATUS | `companyStatus` ≠ Active (e.g. Strike Off, Under Liquidation, Amalgamated, Dissolved, Under process of striking off) | critical | 20 | yes |
| MCA-02 | G-FILING | Latest balance-sheet date > 36 months old OR AGM date > 36 months old → 12 (high); balance-sheet date > 24 months OR AGM date > 18 months → 8 (medium). Dates `null` are ignored (not penalised) | high/medium | 12/8 | no |
| MCA-03 | per director | A director flagged disqualified (from MCA output or the regulatory adapter's `MCA_DISQUALIFIED_DIRECTORS` matches, deduped by DIN/name) | high | 12 (once, not per director) | no |
| MCA-04 | G-CAPITAL | paid-up capital < ₹1,00,000 | low | 3 | no |

### LEGAL
Only cases/notices with `matchConfidence ≥ 0.7` count (missing value is treated as 1.0 only for fixtures; live normalisers MUST set it from state/city/director overlap). Lower-confidence items become `info` findings "Possible match — verify".
| Rule | Group | Condition | Severity | Penalty | Hard stop |
|---|---|---|---|---|---|
| LEG-01 | G-INSOLV | an insolvency notice whose type matches /CIRP\|insolvency\|liquidation\|winding/i | critical | 25 | yes |
| LEG-02 | G-CASES | pending case, role Respondent/Defendant/Accused, type matches /138\|cheque\|recovery\|DRT\|SARFAESI/i | high | 12 | no |
| LEG-03 | G-CASES | ≥ 3 pending cases where role is Respondent | medium | 8 | no |
| LEG-04 | G-CASES | any pending case (any role) | low | 3 | no |

### ADVERSE
Articles older than 24 months are ignored for penalties (shown as info).
| Rule | Group | Condition | Severity | Penalty | Hard stop |
|---|---|---|---|---|---|
| NEWS-01 | G-NEWS | an article with severity `high` and `entityMatchConfidence ≥ 0.7` | high | 12 | no |
| NEWS-02 | G-NEWS | severity `medium` and confidence ≥ 0.7 | medium | 6 | no |
| NEWS-03 | — | `positive_growth` article, confidence ≥ 0.7 | info | 0 | no |
| REG-01 | G-REG | `regulatory` match from SEBI_ORDERS / IBBI / OTHER, `confidence ≥ 0.8` (excludes MCA disqualified-director list, which feeds MCA-03) | high | 10 | no |

### LEGITIMACY
| Rule | Group | Condition | Severity | Penalty | Hard stop |
|---|---|---|---|---|---|
| BIZ-01 | G-UDYAM | `udyam` adapter ran and returned `not_found` (or a provided Udyam number could not be verified) | low | 4 | no |
| BIZ-02 | G-NAME | normalised names across GST/MCA/Udyam have token-set similarity < 0.85 | medium | 5 | no |
| BIZ-03 | G-ADDR | state parsed from GST principal place ≠ state parsed from MCA registered address (skip if either unparseable) | medium | 5 | no |

**Name normalisation:** lowercase; strip parentheticals (e.g. "(Demo)"); expand `pvt→private`, `ltd→limited`; remove punctuation; token-set ratio.

### COVERAGE (informational, 0 penalty)
`COVERAGE-<ADAPTER>`: created for any adapter that is `failed`, `timeout`, `captcha_blocked`, `skipped`, or not requested. Evidence is the source run. Message: "Could not verify <category>: <reason>".

## 3. Coverage and provisional

`coverage = Σ cap(category) for categories whose primary adapter status ∈ {succeeded, not_found, carried_forward}` ÷ 100.
`isProvisional = coverage < 0.60`. Categories whose adapter was not requested count as uncovered.

## 4. Grade and recommendation

| Condition | Grade | Recommendation |
|---|---|---|
| Any hard stop | D | `Escalate – high risk (hard stop: <rule titles>)` |
| score ≥ 85 | A | `Proceed with standard checks` |
| 70–84 | B | `Proceed with conditions` |
| 50–69 | C | `Manual review required` |
| < 50 | D | `Escalate – high risk` |

If `isProvisional` and grade ∈ {A, B}: recommendation becomes `Manual review required (limited coverage)`. The UI labels the score "Provisional" when `isProvisional`.

## 5. Monitoring runs

A monitoring case runs only cheap adapters (default `gst`, `news`). Other categories reuse the **latest successful normalized result** from the previous case, marked `carried_forward` (counts toward coverage; UI shows "carried forward from <date>"). Findings from carried-forward data keep their original evidence timestamps.

## 6. Diff rules (for alerts)

Compare by `fingerprint`. Fingerprints: `GST-01:<gstin>`, `GST-FILING:<gstin>`, `MCA-02:<cin>`, `MCA-03:<din|name>`, `LEG-0x:<caseNumber>`, `LEG-01:<noticeUrl>`, `NEWS:<articleUrl>`, `REG-01:<matchUrl>`, `BIZ-0x:<gstin>`. See FRD FR-10.3 for severity mapping.

## 7. Worked examples (fixtures)

| Company | STAT | CORP | LEGAL | ADV | LEGIT | Score | Grade |
|---|---|---|---|---|---|---|---|
| Aravali (clean) | 0 | 0 | 3 (LEG-04) | 0 | 0 | **97** | A |
| Sunrise (t0) | 8 (GST-03) | 8 (MCA-02) | 12 (LEG-02) | 6 (NEWS-02) | 0 | **66** | C |
| Sunrise (t1, GST suspended) | 30 (GST-01; 38 raw, capped) | 8 | 12 | 12 (NEWS-01) | 0 | **38** | D (hard stop) |
| Kaveri (distressed) | 30 (GST-01 + filing, capped) | 20 (MCA-02 12 + MCA-03 12, capped) | 25 (LEG-01) | 12 (NEWS-01) | 4 (BIZ-01) | **9** | D (hard stop) |

## 8. Required unit tests (`lib/scoring/*.test.ts`)

- One test per rule: triggers, does not trigger, boundary values (e.g. missed=2/3/5/6; BS age 24/36 months; paid-up ₹99,999 vs ₹1,00,000).
- Group logic: highest-in-group only; category cap; hard stop forces D even at high score.
- Coverage: each adapter status; provisional boundary at 0.59/0.60; provisional downgrades A/B recommendation.
- Low-confidence legal/news items produce no penalty.
- Fixtures: reproduce the table above exactly (`score`, `grade`, `hardStops`).
- Carried-forward data counts toward coverage and is labelled.

## 9. What the LLM may and may not do

May: classify news (with disambiguation), write the narrative from findings. May not: change, create or remove findings, penalties, scores, grades or recommendations; introduce facts not in findings.

## 10. Versioning

`RULES_VERSION = '1.0.0'` stored on every case. Any change to rules, caps or thresholds increments it and updates this document and the tests in the same commit.
