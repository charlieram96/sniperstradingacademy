# Phase B: Fintech Design System Build-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the winning "Modern Fintech Pro" direction into the complete Snipers Trading Academy design system as browsable grouped preview cards, published to the existing Claude Design project for Charlie's iterative review.

**Architecture:** Fourteen self-contained HTML preview cards under `docs/design/previews/system/`, organized in three pane groups (Foundations, Components, Patterns). Every card inlines the Canonical Token Sheet (below) so cards render independently; the fintech Phase A files (`docs/design/previews/directions/fintech/`) are the visual reference. One DesignSync publish task at the end (single finalize_plan); iteration rounds re-upload changed cards under new plans.

**Tech Stack:** Hand-authored HTML/CSS (no build step), DesignSync tool, Chrome (via claude-in-chrome) for render verification.

## Global Constraints

- Product name is **Snipers Trading Academy** everywhere (never "TradingHub").
- All previews **dark-canvas only**; each file sets its own background.
- Every HTML file **fully self-contained**: inline `<style>`, no external fonts/scripts/images; icons and logo are inline SVG (1.5px stroke line icons, crosshair-in-circle logo).
- **System font stacks only**: sans `-apple-system, "SF Pro Text", Inter, "Segoe UI", sans-serif`; mono `ui-monospace, "SF Mono", "Geist Mono", Menlo, monospace`. All numerals `font-variant-numeric: tabular-nums` in mono stack.
- First line of every file: `<!-- @dsCard group="<GROUP>" -->` where GROUP is exactly `Foundations`, `Components`, or `Patterns`. `<title>` names the card (e.g. `<title>Colors & Elevation</title>`).
- Author at 1440px width; no horizontal scroll; wide content scrolls inside its own container.
- Mock data only from the Mock Data Inventory below — no lorem ipsum, no invented figures.
- Visual identity: match the Phase A fintech files (`docs/design/previews/directions/fintech/dashboard.html`, `components.html`) — crisp 1px borders, 4px grid density, delta chips, tabular mono numerals, gold used functionally (primary actions, focus rings, active states, chart fills, key figures).
- Commit to git on `staging` after each task.

## Canonical Token Sheet (inline this `:root` block verbatim in every card)

```css
:root {
  /* Base */
  --bg:#05080F; --surface:#0A0F1C; --surface-raised:#101728; --surface-overlay:#151D33;
  --ink:#E6EAF2; --ink-2:#8B95A9; --ink-3:#525D73;
  --border:rgba(255,255,255,0.10); --border-subtle:rgba(255,255,255,0.05); --border-strong:rgba(255,255,255,0.16);
  /* Brand gold ramp */
  --gold-50:#FDF8ED; --gold-100:#F9ECCC; --gold-200:#F0D48A; --gold-300:#E5C06A;
  --gold-400:#D4A853; --gold-500:#C49B3E; --gold-600:#A67E2E; --gold-700:#856420; --gold-800:#6B4D18;
  --gold:var(--gold-400); --ring:rgba(212,168,83,0.55);
  /* Status */
  --emerald:#34D399; --emerald-dim:rgba(52,211,153,0.12);
  --red:#F87171; --red-dim:rgba(248,113,113,0.12);
  --amber:#FBBF24; --amber-dim:rgba(251,191,36,0.12);
  --blue:#60A5FA; --blue-dim:rgba(96,165,250,0.12);
  /* Charts (series order) */
  --chart-1:var(--gold-400); --chart-2:#60A5FA; --chart-3:#34D399; --chart-4:#A78BFA; --chart-5:#8B95A9;
  /* Spacing (4px grid) */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-8:32px; --sp-10:40px; --sp-12:48px; --sp-16:64px;
  /* Radius */
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-pill:999px;
  /* Shadows */
  --sh-sm:0 1px 2px rgba(0,0,0,0.35);
  --sh-md:0 4px 12px rgba(0,0,0,0.28),0 1px 3px rgba(0,0,0,0.3);
  --sh-lg:0 12px 32px rgba(0,0,0,0.35),0 4px 8px rgba(0,0,0,0.25);
  --sh-gold:0 2px 12px rgba(212,168,83,0.18);
  /* Type scale */
  --t-xs:11px; --t-sm:12px; --t-base:13px; --t-md:14px; --t-lg:16px; --t-xl:18px; --t-2xl:22px; --t-3xl:28px; --t-4xl:36px;
  /* Motion */
  --dur-micro:120ms; --dur-std:200ms; --dur-enter:320ms;
  --ease-out:cubic-bezier(0.2,0.8,0.2,1); --ease-spring:cubic-bezier(0.34,1.4,0.44,1);
}
```

## Mock Data Inventory

Everything from Phase A carries over: rank Delta Master Sniper (2 complete), 12% rate, structures 3/6 (structure 3 at 231/1,092 = 21%), pool $48,315.00, commission $5,797.80, referrals 7 of 9, team 2,560 (2,415 active), wallet 0x7C4d…9E2a · Polygon · USDC, classes ("Live Market Session — NY Open" LIVE / "London Session Breakdown" Jul 22 3:00 AM EST / "Risk Management Masterclass" Jul 23 7:00 PM EST), payout history Jul 1 $5,412.00 · Jun 1 $4,988.50 · May 1 $4,750.25 (all Paid), 6-month pool series 31.2k → 34.8k → 38.1k → 40.9k → 44.6k → 48.3k (Feb–Jul).

Phase B additions (use exactly these):
- Notifications: "Payout sent — $5,412.00 USDC" (Jul 1, success) · "New team member: Maria G. joined Structure 3" (Jul 18, info) · "Rank up! You reached Delta Master Sniper" (Jun 30, celebration) · "Subscription renews in 3 days" (Jul 25, warning).
- Bar chart "Referrals by month" (Feb–Jul): 2, 4, 3, 6, 5, 7.
- Donut "Team by structure": S1 1,092 · S2 1,092 · S3 231 · unfilled 861.
- Table (dense) "Team members": Maria G. · S3 · Active · Jul 18, 2026 / James T. · S2 · Active · May 2, 2026 / Lena K. · S1 · Inactive · Feb 11, 2026.
- Celebration moments: rank-up to Delta Master Sniper; payout received $5,412.00 USDC.
- All ranks for the badge set: Unranked, Delta Master, Delta Master Sniper, Trend Master, Trend Master Sniper, Lion Master, Lion Master Sniper.

## Verification checklist (every card, before its commit)

1. Renders at 1440px, no horizontal page scroll (Chrome screenshot over localhost — the extension blocks file://).
2. `grep -ri tradinghub <file>` empty; `grep -E 'https?://' <file>` hits only `data:`/xmlns strings; no `<script src`/`<link`.
3. Token block matches the Canonical Token Sheet character-for-character.
4. Every element listed in the task's Card Contents appears; states are labeled (DEFAULT / HOVER / FOCUS / DISABLED / LOADING as static examples).
5. Card reads as the fintech direction next to `directions/fintech/components.html`.

---

### Task 1: Foundations — Colors & Elevation + Typography & Spacing

**Files:**
- Create: `docs/design/previews/system/foundations/colors.html` (`@dsCard group="Foundations"`, title "Colors & Elevation")
- Create: `docs/design/previews/system/foundations/typography.html` (`@dsCard group="Foundations"`, title "Typography & Spacing")

**Interfaces:**
- Consumes: Canonical Token Sheet, Mock Data Inventory.
- Produces: the visual reference cards later tasks' implementers eyeball for ramp/scale correctness.

**Card Contents — colors.html:** full gold ramp as labeled swatch row (50–800, hex printed in mono); base surfaces stack (bg → surface → raised → overlay) rendered as nested panels with elevation shadows applied and labeled; border tiers demo; status colors with their -dim washes as chip pairs; chart palette as 5 labeled series swatches with a mini stacked bar demo; usage table (token → role → example) for semantic roles (primary action, focus ring, positive delta, destructive, info).

**Card Contents — typography.html:** type scale specimen (every --t-* rendered with px label, sans for text sizes, mono+tabular for a numeral column showing $5,797.80 at each size); weight guide (400/500/600 usage rows); letter-spacing rules for uppercase labels; spacing scale as labeled ruler bars (--sp-1 … --sp-16); radius specimens (--r-sm/md/lg/pill on sample tiles); the 4px-grid card-anatomy diagram (a stat tile with padding/gap measurements annotated).

- [ ] **Step 1: Write `colors.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist (serve `docs/design/previews` over localhost, screenshot at 1440×900).
- [ ] **Step 3: Write `typography.html`** per Card Contents.
- [ ] **Step 4: Verify** per checklist.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/foundations/
git commit -m "Phase B: foundations cards (colors, typography)"
```

### Task 2: Foundations — Motion & Icons

**Files:**
- Create: `docs/design/previews/system/foundations/motion.html` (`@dsCard group="Foundations"`, title "Motion & Icons")

**Interfaces:**
- Consumes: Canonical Token Sheet.
- Produces: the motion timing/easing rules and the icon style spec later component cards must follow.

**Card Contents:** duration scale demo (three side-by-side boxes animating translateX on hover at --dur-micro/std/enter, each labeled with its token and ms); easing comparison (ease-out vs ease-spring, looping 3s demo balls); the shimmer keyframe spec (skeleton bar running the canonical left-to-right shimmer, keyframe code printed beside it in mono); reduced-motion note rendered as a do/don't row; icon grid — the 8 nav icons plus 8 more (check, x, alert-triangle, external-link, wallet, trending-up, play-circle, clock) drawn at 20px/1.5px stroke on a labeled 24px grid tile, with stroke/size/corner rules printed; logo usage row (crosshair-in-circle at 3 sizes with clearspace guides).

- [ ] **Step 1: Write `motion.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist; confirm ≤4 elements animate continuously and hover demos are static until hovered.
- [ ] **Step 3: Commit**

```bash
git add docs/design/previews/system/foundations/motion.html
git commit -m "Phase B: motion & icons card"
```

### Task 3: Components — Buttons & Forms

**Files:**
- Create: `docs/design/previews/system/components/buttons.html` (`@dsCard group="Components"`, title "Buttons")
- Create: `docs/design/previews/system/components/forms.html` (`@dsCard group="Components"`, title "Forms & Inputs")

**Interfaces:**
- Consumes: Canonical Token Sheet; motion/icon rules from Task 2's card.
- Produces: the button and input treatments every later card reuses for embedded CTAs.

**Card Contents — buttons.html:** variants × states matrix — primary (solid gold, navy text), secondary (raised surface), outline, ghost, destructive; each in sm(28px)/md(34px)/lg(40px) heights; each variant's DEFAULT/HOVER/FOCUS/DISABLED/LOADING rendered as labeled static examples (hover = simulated with the hover style applied, focus = 2px --ring); icon-leading and icon-only forms; button-group row; link-style button. State rules printed as a mono spec table (bg/border/ink per state).

**Card Contents — forms.html:** text input (default/focus/error with message "Wallet address is invalid"/disabled/with leading icon); select (closed + open-panel mock); textarea; checkbox, radio group, switch — each unchecked/checked/disabled; labeled field anatomy (label 12px --ink-2 uppercase, 6px gap, help text row); inline validation pattern (the wallet field with error); a composed "Payout wallet" form section using inventory data ending in a primary Save button; calendar month grid (July 2026, today Jul 21 ring-highlighted, Jul 22–23 dot-marked for the scheduled classes, prev/next chevrons — covers the shadcn calendar/date-picker).

- [ ] **Step 1: Write `buttons.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Write `forms.html`** per Card Contents.
- [ ] **Step 4: Verify** per checklist.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/components/
git commit -m "Phase B: buttons and forms cards"
```

### Task 4: Components — Cards & Navigation

**Files:**
- Create: `docs/design/previews/system/components/cards.html` (`@dsCard group="Components"`, title "Cards & Surfaces")
- Create: `docs/design/previews/system/components/navigation.html` (`@dsCard group="Components"`, title "Navigation")

**Interfaces:**
- Consumes: Canonical Token Sheet; button treatments from Task 3.
- Produces: card anatomy and nav treatments reused by Pattern cards.

**Card Contents — cards.html:** base card (surface, 1px border, --r-md, --sh-sm) with anatomy annotations; raised/interactive card (hover state: --border-strong + --sh-md, labeled); featured card (gold top hairline + --sh-gold); stat tile (from fintech dashboard: label, mono numeral, delta chip, sparkline); accordion (one open one closed, real question copy: "How are commissions calculated?" → "Your rate is 10% plus 1% per completed structure, paid monthly in USDC."); separator specimens; scroll-area demo (fixed-height list of the 7 ranks scrolling inside its container).

**Card Contents — navigation.html:** the sidebar (240px, from fintech dashboard: logo, 8 items in canonical order, active state gold left-bar, user chip) rendered full-height; collapsed 64px icon-rail variant beside it; horizontal tabs (Overview / Payouts / Settings — active gold underline); breadcrumb row (Academy / Module 3 / Lesson 2); pagination row (‹ 1 2 3 … 12 ›); dropdown menu panel mock (Profile / Settings / Sign out with icons).

- [ ] **Step 1: Write `cards.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Write `navigation.html`** per Card Contents.
- [ ] **Step 4: Verify** per checklist.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/components/cards.html docs/design/previews/system/components/navigation.html
git commit -m "Phase B: cards and navigation cards"
```

### Task 5: Components — Overlays & Feedback

**Files:**
- Create: `docs/design/previews/system/components/overlays.html` (`@dsCard group="Components"`, title "Overlays")
- Create: `docs/design/previews/system/components/feedback.html` (`@dsCard group="Components"`, title "Feedback & Status")

**Interfaces:**
- Consumes: Canonical Token Sheet; buttons from Task 3; card anatomy from Task 4.
- Produces: toast/badge/alert treatments the Patterns cards reuse.

**Card Contents — overlays.html:** modal dialog mock (surface-overlay panel, --sh-lg, backdrop wash rgba(0,0,0,0.6), real content: "Confirm payout — Send $5,797.80 USDC to 0x7C4d…9E2a?" with Cancel/ghost + Confirm/primary); destructive alert-dialog variant ("Remove team member?" with Delete/destructive); popover (anchored to a labeled trigger); tooltip (mono, --t-xs); each with anatomy annotations (padding, radius, shadow tokens printed).

**Card Contents — feedback.html:** toast set — success ("Payout sent — $5,412.00 USDC"), error ("Transaction failed — insufficient gas"), info ("New team member: Maria G. joined Structure 3"), warning ("Subscription renews in 3 days") — each with icon, 1px status border, dim wash; inline alert banner variants (the same four semantics, full-width); badge set — status badges (Active/emerald, Inactive/ink-3, Paid/emerald, Pending/amber, LIVE/red pulse dot, Complete/gold, Locked/outline) plus all 7 rank badges (Unranked → Lion Master Sniper, gold intensity scaling with rank); avatar (initials "CR", 3 sizes, plus avatar-with-status-dot); progress bar (21%) and progress ring (21%, from fintech components).

- [ ] **Step 1: Write `overlays.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Write `feedback.html`** per Card Contents.
- [ ] **Step 4: Verify** per checklist.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/components/overlays.html docs/design/previews/system/components/feedback.html
git commit -m "Phase B: overlays and feedback cards"
```

### Task 6: Patterns — Data Tables & Charts

**Files:**
- Create: `docs/design/previews/system/patterns/tables.html` (`@dsCard group="Patterns"`, title "Data Tables")
- Create: `docs/design/previews/system/patterns/charts.html` (`@dsCard group="Patterns"`, title "Charts")

**Interfaces:**
- Consumes: Canonical Token Sheet; badges from Task 5; chart palette tokens.
- Produces: the chart specs Task 7's moments/states cards may embed.

**Card Contents — tables.html:** dense data table (Team members data from inventory: name+avatar, structure, status badge, joined date; 40px rows, uppercase --t-xs header, right-aligned mono dates, row hover wash, one selected row); payout-history table (Phase A data) with footer totals row ($15,150.75); sortable-header states (default/asc-arrow/desc-arrow, labeled); table toolbar (search input + filter chip "Active only ×" + primary Export button); mobile-collapse note rendered as a 360px-wide stacked-row demo inside a labeled frame.

**Card Contents — charts.html:** sparkline spec (120×36 + 4px right margin rule printed — endpoint dot must clear the viewBox); area chart (the 6-month pool series with gridlines, gold gradient fill, axis label rules); bar chart (Referrals by month: 2,4,3,6,5,7 — gold bars, hover state on one bar with mono tooltip "Jun · 5"); donut (Team by structure: 1,092/1,092/231 gold/blue/emerald + 861 unfilled track, center label "2,415 active"); chart-card anatomy (title, value, delta chip, chart, footnote — annotated); do/don't row (no 3D, no >5 series, gridlines at --border-subtle).

- [ ] **Step 1: Write `tables.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Write `charts.html`** per Card Contents; hand-compute SVG coordinates (series above; keep every stroke/dot inside its viewBox).
- [ ] **Step 4: Verify** per checklist; zoom the screenshot on chart edges for clipping.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/patterns/tables.html docs/design/previews/system/patterns/charts.html
git commit -m "Phase B: tables and charts cards"
```

### Task 7: Patterns — States & Moments

**Files:**
- Create: `docs/design/previews/system/patterns/states.html` (`@dsCard group="Patterns"`, title "Empty, Loading & Error States")
- Create: `docs/design/previews/system/patterns/moments.html` (`@dsCard group="Patterns"`, title "Hero & Celebration Moments")

**Interfaces:**
- Consumes: Canonical Token Sheet; toasts/badges from Task 5; charts from Task 6.
- Produces: the celebratory treatments Phase C will port for rank-up/payout events.

**Card Contents — states.html:** empty states — no classes scheduled (icon + line + ghost CTA "Browse academy"), no team members yet (icon + "Share your referral link" + primary CTA), no notifications (minimal); skeleton set — stat-tile skeleton, table-row skeleton ×3, class-card skeleton, all sharing one shimmer; error states — full-card error ("Couldn't load payouts" + Retry outline button), inline field error, page-level error banner; loading button + spinner spec (16px, 0.6s linear).

**Card Contents — moments.html:** rank-up celebration card ("Rank up! · Delta Master Sniper" — gold gradient wash, rank badge scaled 48px, subtle one-shot rise+fade-in confetti dots ≤12, CSS-only, plays once via `animation-fill-mode:both`); payout-received hero ("$5,412.00 USDC sent" with check medallion + tx-hash mono row 0x7C4d…9E2a + View on Polygonscan ghost button — href="#"); milestone progress moment (Structure 3 · 231/1,092 with "861 to go" delta chip and encouragement line "On pace for August"); onboarding welcome hero ("Welcome to Snipers Trading Academy, Charlie" + 3-step checklist with first item checked). Rules row: gold saturation budget — one hero per screen max, printed as a do/don't.

- [ ] **Step 1: Write `states.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Write `moments.html`** per Card Contents.
- [ ] **Step 4: Verify** per checklist; confirm celebration animations are one-shot, not looping.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/system/patterns/states.html docs/design/previews/system/patterns/moments.html
git commit -m "Phase B: states and moments cards"
```

### Task 8: Patterns — App Signatures

**Files:**
- Create: `docs/design/previews/system/patterns/app-signatures.html` (`@dsCard group="Patterns"`, title "App Signatures")

**Interfaces:**
- Consumes: Canonical Token Sheet; everything prior (this card composes the system).
- Produces: the app-specific composite patterns Phase C ports screen-by-screen.

**Card Contents:** the KPI stat row (4 tiles from the fintech dashboard, refined to Task 4's stat-tile spec); the structure selector redesigned to system tokens (7-slot strip: complete/active/locked states + Ultimate card); academy class card set (LIVE + upcoming, from inventory); payout wallet card (configured state, inventory data); notifications list (the 4 inventory notifications as rows with unread dots, using Task 5 toast semantics); each section titled with the screen it belongs to (Dashboard / Academy / Finance / Notifications).

- [ ] **Step 1: Write `app-signatures.html`** per Card Contents.
- [ ] **Step 2: Verify** per checklist.
- [ ] **Step 3: Commit**

```bash
git add docs/design/previews/system/patterns/app-signatures.html
git commit -m "Phase B: app signatures card"
```

### Task 9: Publish to Claude Design

**Files:**
- Reads: `docs/design/previews/system/**/*.html` (14 files from Tasks 1–8)

**Interfaces:**
- Consumes: the 14 card files on disk; existing projectId `2fdcb475-d49c-4ba0-9df1-08dfb63a9969`.
- Produces: the Foundations/Components/Patterns groups live in the Claude Design pane alongside the Phase A direction cards (which stay — do not delete anything).

- [ ] **Step 1: Verify project** — `DesignSync {method: "get_project", projectId: "2fdcb475-d49c-4ba0-9df1-08dfb63a9969"}`. Expected `type: PROJECT_TYPE_DESIGN_SYSTEM`, `canEdit: true`.
- [ ] **Step 2: Finalize plan** — `DesignSync {method: "finalize_plan", projectId, localDir: "/Users/charlieramirez/Desktop/tradinghub/docs/design/previews", writes: ["system/**/*.html"], deletes: []}`. Record `planId`.
- [ ] **Step 3: Upload** — `DesignSync {method: "write_files", projectId, planId, files: [...]}` — 14 entries, each `{path: "system/…", localPath: "system/…", mimeType: "text/html"}`.
- [ ] **Step 4: Verify** — `DesignSync {method: "list_files", projectId}` shows all 14 new paths plus the 6 Phase A paths.
- [ ] **Step 5: Hand off** — message Charlie: the three groups are live; review on claude.ai/design and give feedback per card ("colors: darker bg", "moments: too much confetti"); iteration rounds edit files and re-publish under a fresh finalize_plan until approved. Approval = Phase B exit → Phase C plan.
