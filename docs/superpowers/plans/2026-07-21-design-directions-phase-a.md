# Phase A: Design Direction Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three distinct visual-direction previews (dashboard mock + component sheet each) and publish them to a new "Snipers Trading Academy Design System" project on claude.ai/design for Charlie to pick a winner.

**Architecture:** Six self-contained HTML preview files (all CSS inline, no external requests) live in `docs/design/previews/` in the repo. Each renders at 1440px desktop width on its own dark canvas. They are pushed to Claude Design via the DesignSync tool (create_project → finalize_plan → write_files). No app code is touched.

**Tech Stack:** Hand-authored HTML/CSS (no build step), DesignSync tool, Chrome (via claude-in-chrome) for render verification.

## Global Constraints

- Product name is **Snipers Trading Academy** everywhere (never "TradingHub"). Support domain: sniperstradingacademy.com.
- All previews are **dark-canvas only** — each file sets its own background; never depend on viewer theme.
- Every HTML file is **fully self-contained**: inline `<style>`, no external fonts/scripts/images (CSP blocks them). Logos are inline SVG (a gold crosshair/scope mark drawn in SVG — do not try to embed `public/gold-logo.svg` as a file reference; redraw a simple crosshair-in-circle mark inline).
- **System font stacks only** (real webfonts come in Phase C via next/font). Serif stack: `Didot, "Bodoni MT", "Playfair Display", Georgia, serif`. Sans stack: `-apple-system, "SF Pro Text", Inter, Segoe UI, sans-serif`. Mono stack: `ui-monospace, "SF Mono", "Geist Mono", Menlo, monospace`.
- Every direction keeps **navy + gold**. Gold anchor `#D4A853` may shift per direction but must stay recognizably the brand gold.
- **No lorem ipsum** — all mock content comes from the Content Inventory below.
- First line of every preview file is a `@dsCard` marker comment (format in Task 1). `<title>` tag names the card.
- Files are committed to git on `staging` after each task.

## Content Inventory (used verbatim in every dashboard mock)

Sidebar nav (in order, with lucide-equivalent icons drawn as inline SVG): Dashboard (active), Academy, My Team, Finance, Payments, Referrals, Notifications, Settings. Logo at top, user chip at bottom ("Charlie R." / charlieram96@gmail.com).

Page header: title "Dashboard", subtitle "Welcome back, Charlie".

Consistent mock data (obeys real app math: commission % = 10 + completed structures; each structure holds 1,092 members):

| Datum | Value |
|---|---|
| Rank | Delta Master Sniper (2 structures complete) |
| Commission rate | 12% |
| Structures unlocked | 3 of 6 |
| Team pool (monthly) | $48,315.00 |
| Your commission | $5,797.80 (gold highlight) |
| Active direct referrals | 7 of 9 |
| Total team | 2,560 (2,415 active) |
| Structure 3 progress | 231 / 1,092 members |
| Payout wallet | 0x7C4d…9E2a · Polygon · $5,797.80 USDC est. |

Academy schedule (3 class cards): "Live Market Session — NY Open" (**LIVE** badge, red pulse dot, Join Class button), "London Session Breakdown" (Upcoming, Jul 22, 2026 3:00 AM EST), "Risk Management Masterclass" (Upcoming, Jul 23, 2026 7:00 PM EST).

Structure selector strip: structures 1–2 Complete (gold badge), 3 active with progress bar (231/1092), 4–6 locked (40% opacity), plus the "Ultimate — Lion Master Sniper 16%" end card, locked.

Stats grid (4 tiles): Team Pool / Your Commission / Active Direct Referrals / Total Team, values above.

## Component Sheet Inventory (used verbatim in every component sheet)

Sections, in order: **Type scale** (display, H1–H3, body, caption, mono numerals); **Buttons** (primary, secondary, outline, ghost, destructive × sm/md/lg, plus loading and disabled states); **Stat tiles** (2 examples with real data from inventory); **Cards** (default, elevated, and the direction's signature treatment); **Inputs** (text field default + focused + error, select, toggle); **Badges** (LIVE, Complete, Upcoming, Locked, rank badge "Delta Master Sniper"); **Progress** (bar at 21%, and the direction's take on it); **Table** (3-row payout history: Jul 1 $5,412.00 Paid · Jun 1 $4,988.50 Paid · May 1 $4,750.25 Paid); **Empty state** ("No classes scheduled" with icon); **Skeleton/loading** (shimmering stat tile).

---

### Task 1: Direction 1 — "Private-Bank Luxury" previews

**Files:**
- Create: `docs/design/previews/directions/luxury/dashboard.html`
- Create: `docs/design/previews/directions/luxury/components.html`

**Interfaces:**
- Consumes: Content Inventory and Component Sheet Inventory (above).
- Produces: two self-contained HTML files whose project-relative paths (`directions/luxury/*.html`) Task 4 uploads.

**Direction spec (exact tokens):**

```css
/* Luxury — restrained, editorial, quiet confidence */
--bg: #070B14;            /* warm near-black navy */
--surface: #0C1120;       /* flat, opaque; NO glass, NO glow */
--surface-raised: #111729;
--ink: #E8E4DA;           /* warm off-white */
--ink-2: #9BA3B4;
--ink-3: #5C6577;
--gold: #C9A45C;          /* slightly desaturated, old-money gold */
--gold-bright: #E5C685;
--hairline: rgba(201,164,92,0.28);   /* 1px gold hairline rules */
--border: rgba(255,255,255,0.07);
--radius: 6px;            /* small radius, architectural */
--pad-card: 36px;         /* generous, unhurried spacing */
```

Rules: serif stack for display/headings/large numerals (light weight, `font-weight:300–400`, large sizes); sans for body. Section labels in 11px letterspaced small caps (`letter-spacing:0.18em; text-transform:uppercase; color:var(--gold)`). Gold appears ONLY in: hairlines, small-caps labels, the commission figure, rank badge, primary button (solid gold, navy text). No shadows stronger than `0 1px 2px rgba(0,0,0,0.4)`. Crosshair logo as thin-stroke (1.5px) SVG. Stat tiles: numeral in 40px serif light, hairline rule above label. LIVE badge: gold dot, not red, with small-caps "LIVE".

- [ ] **Step 1: Write `dashboard.html`** — first line `<!-- @dsCard group="Direction 1 — Private-Bank Luxury" -->`, `<title>Luxury — Dashboard</title>`, full 1440px layout: sidebar (240px) + main column rendering the entire Content Inventory in this direction's language.
- [ ] **Step 2: Verify render** — open `file:///Users/charlieramirez/Desktop/tradinghub/docs/design/previews/directions/luxury/dashboard.html` in Chrome (claude-in-chrome), screenshot at 1440×900. Check: no horizontal scroll, no missing sections vs Content Inventory, no default-blue links, serif numerals actually rendering.
- [ ] **Step 3: Write `components.html`** — first line `<!-- @dsCard group="Direction 1 — Private-Bank Luxury" -->`, `<title>Luxury — Components</title>`, every section of the Component Sheet Inventory, same tokens.
- [ ] **Step 4: Verify render** — same Chrome check for `components.html`. All 10 inventory sections present.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/directions/luxury/
git commit -m "Phase A: luxury direction previews"
```

### Task 2: Direction 2 — "Modern Fintech Pro" previews

**Files:**
- Create: `docs/design/previews/directions/fintech/dashboard.html`
- Create: `docs/design/previews/directions/fintech/components.html`

**Interfaces:**
- Consumes: Content Inventory and Component Sheet Inventory.
- Produces: `directions/fintech/*.html` for Task 4.

**Direction spec (exact tokens):**

```css
/* Fintech — crisp, data-dense, engineered */
--bg: #05080F;
--surface: #0A0F1C;
--surface-raised: #101728;
--ink: #E6EAF2;
--ink-2: #8B95A9;
--ink-3: #525D73;
--gold: #D4A853;          /* brand gold, used functionally */
--emerald: #34D399;       /* positive deltas */
--red: #F87171;           /* negative / alerts */
--border: rgba(255,255,255,0.10);  /* crisp 1px borders everywhere */
--ring: rgba(212,168,83,0.55);
--radius: 10px;
--pad-card: 20px;         /* dense */
```

Rules: sans stack throughout, 13–14px base, semibold 20–28px stat numerals in mono stack with `font-variant-numeric: tabular-nums`. Every metric gets a delta chip (e.g. "+8.2%" emerald, "▲ 231 this month"). Add an inline SVG sparkline/area chart with gold gradient fill inside the Team Pool and Commission tiles, and a larger 7-point area chart card ("Team pool — last 6 months": 31.2k, 34.8k, 38.1k, 40.9k, 44.6k, 48.3k). Hover/active states visible on the component sheet (rendered as labeled static examples). Focus ring: 2px `var(--ring)`. Skeleton uses a left-to-right shimmer gradient. LIVE badge: red pulse dot (as in the real app). Gold reserved for: primary buttons, focus rings, active nav item, chart fills, commission figure.

- [ ] **Step 1: Write `dashboard.html`** — first line `<!-- @dsCard group="Direction 2 — Modern Fintech Pro" -->`, `<title>Fintech — Dashboard</title>`, full Content Inventory + the 6-month area chart card.
- [ ] **Step 2: Verify render** — Chrome screenshot at 1440×900; additionally check charts draw correctly (no clipped SVG viewBox) and numerals are tabular.
- [ ] **Step 3: Write `components.html`** — first line `<!-- @dsCard group="Direction 2 — Modern Fintech Pro" -->`, `<title>Fintech — Components</title>`, full Component Sheet Inventory + a "Charts" section (sparkline, area, progress-ring).
- [ ] **Step 4: Verify render** — Chrome check, all sections present.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/directions/fintech/
git commit -m "Phase A: fintech direction previews"
```

### Task 3: Direction 3 — "Rich & Cinematic" previews

**Files:**
- Create: `docs/design/previews/directions/cinematic/dashboard.html`
- Create: `docs/design/previews/directions/cinematic/components.html`

**Interfaces:**
- Consumes: Content Inventory and Component Sheet Inventory.
- Produces: `directions/cinematic/*.html` for Task 4.

**Direction spec (exact tokens):**

```css
/* Cinematic — depth, glass, glow; loud but controlled */
--bg: #04060D;
--mesh-a: rgba(212,168,83,0.10);   /* animated gradient mesh blobs */
--mesh-b: rgba(59,130,246,0.07);
--glass: rgba(15,22,41,0.62);      /* cards: blur(24px) glass */
--glass-border: rgba(255,255,255,0.09);
--ink: #EDF0F7;
--ink-2: #97A1B6;
--gold: #E0B665;                   /* brighter, luminous gold */
--gold-deep: #A67E2E;
--glow: 0 0 24px rgba(224,182,101,0.22), 0 0 64px rgba(224,182,101,0.08);
--radius: 18px;
--pad-card: 28px;
```

Rules: fixed animated background — two large blurred radial blobs (`filter: blur(90px)`, CSS keyframe drift ≥30s, subtle). All cards are glass (`backdrop-filter: blur(24px)`). Hero moment: "Your Commission" becomes a large centerpiece card with 56px gradient-gold numeral (`background: linear-gradient(135deg, var(--gold), #F0D48A); -webkit-background-clip: text`) and a gold glow. Gradient hairline borders on featured cards (gold → transparent, via mask technique). Rank badge is a medallion: circular gold-gradient disc with crosshair mark. Primary buttons carry `box-shadow: var(--glow)`. Section transitions use scale/opacity — but keep all animation subtle and ≤3 distinct moving elements per screen. LIVE badge: red dot + gold shimmer border.

- [ ] **Step 1: Write `dashboard.html`** — first line `<!-- @dsCard group="Direction 3 — Rich & Cinematic" -->`, `<title>Cinematic — Dashboard</title>`, full Content Inventory with the hero commission card.
- [ ] **Step 2: Verify render** — Chrome screenshot at 1440×900; check glass blur renders, mesh animation doesn't cause scrollbars (`overflow:hidden` on body wrapper), text stays readable over glass (contrast).
- [ ] **Step 3: Write `components.html`** — first line `<!-- @dsCard group="Direction 3 — Rich & Cinematic" -->`, `<title>Cinematic — Components</title>`, full Component Sheet Inventory + "Effects" section (glass card, glow button, gradient border, medallion).
- [ ] **Step 4: Verify render** — Chrome check, all sections present.
- [ ] **Step 5: Commit**

```bash
git add docs/design/previews/directions/cinematic/
git commit -m "Phase A: cinematic direction previews"
```

### Task 4: Create Claude Design project and publish

**Files:**
- Reads: `docs/design/previews/directions/**/*.html` (the six files from Tasks 1–3)

**Interfaces:**
- Consumes: the six preview files on disk.
- Produces: a Claude Design project "Snipers Trading Academy Design System" containing them; its `projectId` (record it in the Phase A completion note for Phase B reuse).

- [ ] **Step 1: Check for existing project** — `DesignSync {method: "list_projects"}`. Expected: no project named "Snipers Trading Academy Design System" (spec says none exists). If one appears, STOP and ask Charlie instead of writing into it.
- [ ] **Step 2: Create project** — `DesignSync {method: "create_project", name: "Snipers Trading Academy Design System"}`. Record the returned `projectId`.
- [ ] **Step 3: Verify project type** — `DesignSync {method: "get_project", projectId}`. Expected: `type: PROJECT_TYPE_DESIGN_SYSTEM`, `canEdit: true`.
- [ ] **Step 4: Finalize plan** — `DesignSync {method: "finalize_plan", projectId, localDir: "/Users/charlieramirez/Desktop/tradinghub/docs/design/previews", writes: ["directions/**/*.html"], deletes: []}`. Record `planId`.
- [ ] **Step 5: Upload** — `DesignSync {method: "write_files", projectId, planId, files: [...]}` — six entries, each `{path: "directions/<dir>/<file>.html", localPath: "directions/<dir>/<file>.html"}`.
- [ ] **Step 6: Verify upload** — `DesignSync {method: "list_files", projectId}`. Expected: exactly the six paths.
- [ ] **Step 7: Hand off to Charlie** — final message: link to claude.ai/design, the three direction names with one-line descriptions, and the ask: pick a winner or name a hybrid recipe (e.g. "fintech density + cinematic hero"). Their answer is Phase B's input.

## Verification checklist (applies to every preview before its commit)

1. Renders at 1440px with no horizontal scrollbar.
2. Every Content/Component Inventory item present — count sections against the inventory lists.
3. Product name reads "Snipers Trading Academy"; zero "TradingHub" strings (`grep -ri tradinghub docs/design/previews/` returns nothing).
4. No external requests (`grep -E 'https?://|@import|url\(' <file>` returns nothing, or only `data:`/`#` refs).
5. Commission math consistent: 12% rate, $48,315.00 pool → $5,797.80 commission.
