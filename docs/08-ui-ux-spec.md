# 08 — UI / UX Specification

Audience: credit analysts. Feel: calm, precise, trustworthy, fintech-grade. Dense but legible. The live agent run should feel *alive* without being gimmicky.

## 1. Design tokens

- **Theme:** light default with dark mode via `prefers-color-scheme` and a toggle. Neutral slate surfaces, one accent.
- **Accent:** deep teal `#0F766E` (actions, links, focus). 
- **Severity (always icon + label + colour):** info `#475569` ⓘ · low `#CA8A04` ▲ · medium `#EA580C` ▲▲ · high `#DC2626` ⬣ · critical `#7F1D1D` ✖ (white text on filled chip).
- **Grades:** A `#15803D`, B `#65A30D`, C `#D97706`, D `#B91C1C`.
- **Type:** Inter (UI), JetBrains Mono for identifiers (GSTIN/CIN). Sizes 12/14/16/20/28/40. 
- **Spacing:** 4px grid; cards radius 12px; subtle borders, minimal shadows.
- **Motion:** 150–250 ms transitions; progress shimmer on running lanes; respect `prefers-reduced-motion`.
- Components: shadcn/ui (Button, Card, Badge, Tabs, Sheet/Drawer, Tooltip, Progress, Dialog, Toast), lucide-react icons.

## 2. Global layout

Top bar: logo/name · nav (Check, Watchlist, History) · alert bell with unread badge · theme toggle. Persistent amber **banner in demo mode**: "Demo mode — results come from synthetic replay data." Footer: disclaimer link.

## 3. Screens

### 3.1 Home / New check (`/`)
- Hero line: "Know your borrower in two minutes." Sub: "Live checks across GST, MCA, courts and news — with evidence."
- Large input: "GSTIN, CIN or company name". Live validation under the field: ✓ valid GSTIN → shows derived PAN, state, entity type; ✗ shows which check failed.
- Source checkboxes (default on): GST · MCA · Legal · News · Udyam · Regulatory; each with tooltip describing what is checked. Toggle: "Fresh run (skip cache)".
- Primary button **Run check**. 
- Name input → candidate list (cards with name, city/state, GSTIN, confidence chip) → user picks.
- "Try a demo company" chips (3 fixtures with expected-grade hint hidden until after run).
- Recent checks table (company, grade chip, score, time, status).
- States: validating, invalid, resolving (spinner), empty recent list.

### 3.2 Live run + report (`/cases/[id]`)
One page that morphs from **run view** to **report** as events arrive; no navigation.

**Run view (top section while running):**
- Header: company name, identifiers (mono), elapsed timer, mode badge ("Live" / "Replay data").
- **Agent lanes** (one row per adapter): icon, name, status chip, current action text (latest `source.progress`, truncated, with the current domain), animated progress shimmer, duration when done. Statuses: Queued · Running · Done · No record · Blocked (CAPTCHA) · Failed · Timed out · Skipped. Failed lanes show **Retry**. Click a lane → drawer with step log + raw output (collapsed, "Developer view").
- **Findings feed** to the right: findings animate in as `finding.created` arrives (severity chip, title, one line).
- A running **provisional score ring** appears after the first findings; final when `score.computed`.

**Report (after `report.ready`):**
1. **Verdict header:** score ring (0–100) with grade letter, recommendation text, coverage bar with "x of 5 areas verified", badges: *Provisional*, *Replay data*, *Carried forward*. Actions: Watch · Export JSON · Print · Re-run.
2. **Summary card:** headline + 2–4 sentence summary; tag "AI-written summary" or "Template summary". Below: Key risks, Strengths, Suggested conditions, Questions for borrower (each item shows finding-ID chips that scroll/open the finding).
3. **Category breakdown:** 5 horizontal bars: applied penalty / cap, with category label and status (verified / blocked / not checked).
4. **Findings:** grouped by category, sorted by severity. Row: severity chip, title, penalty ("−12"), confidence, source chips. Expand → detail, rule explanation ("GST-03: 4 of last 12 GSTR-3B not filed. Rule: ≥3 missed → −8"), **Evidence list** (source link, retrieved-at, excerpt, replay tag). Hard-stop findings have a red "Hard stop" tag.
5. **Sources panel:** table of adapters: status, duration, attempts, TinyFish run id (mono, copy), retry.
6. **Timeline (if watched):** previous checks and grade changes.
7. Disclaimer footer.

Report states: complete, partial (amber coverage banner explaining what is missing and why), failed (error card with retry), loading skeletons.

### 3.3 Watchlist (`/watchlist`)
- Table: company, current grade, baseline grade, trend arrow, frequency, last/next run, status toggle.
- Alerts timeline below/side: severity chip, title, "C → D", time, "Simulated" tag, Acknowledge.
- Row action: **Run now**; in demo mode also **Simulate change** (clearly labelled).
- Alert detail (drawer/page): before vs after cards (score, grade), new findings, resolved findings, link to both reports.
- Empty state: "Nothing watched yet. Open a report and click Watch."

### 3.4 History (`/history`) (P1)
List of cases per company with grade over time; compare two snapshots (side-by-side finding diff).

### 3.5 Print view (`/cases/[id]/print`)
Single column, no nav, black-on-white, page breaks between sections, badges retained, footer disclaimer and generated-at timestamp.

### 3.6 Debug (`/debug/cases/[id]`, dev only)
Raw events, raw adapter outputs, zod errors, credits per run.

## 4. Key interactions

- Starting a check navigates immediately to `/cases/[id]`; lanes appear within 1s (queued state before first event).
- Findings and lanes update without layout jumps (reserve space; animate opacity/height).
- Evidence links open in a new tab with `noopener`.
- Alert bell polls `/api/alerts?unread=1` every 20s (and on window focus); toast on new critical alert.
- "Watch" opens a small dialog: frequency (6h / 24h / weekly) and monitored sources; confirmation toast.

## 5. Copy guidelines

- Plain, neutral, factual. Say "could not verify" rather than "failed" in user-facing text where possible; show technical reasons in details.
- Never say "approved/rejected". Use the recommendation strings from `07`.
- Disclaimer: "TrustLens provides decision support based on public information at the time shown. Verify material findings at the source before acting. It is not a credit rating and does not make lending decisions."
- Replay: "Replay data — recorded/synthetic results, not a live check."

## 6. Accessibility

Keyboard-operable lanes/drawers; focus rings; ARIA live region (polite) announcing lane completions and findings; severity never colour-only; contrast ≥ 4.5:1; reduced-motion respected; mobile-friendly stacked layout (lanes above feed).

## 7. Responsive

Desktop-first (demo on laptop/projector). ≥1024px two-column run view; <1024px single column. Report cards stack; tables scroll horizontally in their own container.

## 8. Demo polish checklist

- [ ] Big readable type for projector (base 16px, key numbers 40px+)
- [ ] Lane order fixed: GST, News, MCA, Legal, Udyam, Regulatory
- [ ] Score ring animates once on final score
- [ ] Sunrise watch → simulate change → critical alert toast + bell pulse
- [ ] No console errors; no layout shift; fonts preloaded
