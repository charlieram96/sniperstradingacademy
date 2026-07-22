# Phase C: Design System Port to App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved Modern Fintech Pro design system (the 14 Phase B cards in `docs/design/previews/system/`) into the running app — tokens, shadcn primitives, shared components, then every screen.

**Architecture:** The Phase B cards are the **binding visual spec**; every task names its spec cards and the implementer matches them. Token names in `app/globals.css` are KEPT (so `bg-surface-1`, `text-gold-400` etc. keep resolving) but their values change to the canonical sheet; missing tokens are added. Primitives upgrade first, then new shared components (charts, stat tile, states, moments), then screens in batches — so screens mostly become "replace hand-rolled markup with the upgraded primitives."

**Tech Stack:** Next.js 15 App Router, Tailwind CSS 4 (CSS-first, `@theme inline`), shadcn/ui (Radix + CVA), framer-motion, existing i18n (`useTranslation` — never hardcode user-facing strings that are currently translated).

## Global Constraints

- **VISUAL-ONLY DIFFS.** Screen/component tasks change classNames, JSX structure, styles, and UI imports ONLY. Never touch: data fetching, API calls, handlers' logic, state shape, auth, routing, form submission bodies, payment/payout logic. If a visual goal seems to require a logic change, STOP and report BLOCKED.
- **Fund safety:** nothing in this plan can move funds. The finance/payments/admin-financials tasks restyle presentation around existing logic; any diff line touching a fetch body, handler, or amount computation is a defect.
- Product name **Snipers Trading Academy**; dark-only (no light mode work; do not wire next-themes).
- Spec source of truth: `docs/design/previews/system/**` cards. When a screen needs a pattern, match the card. The canonical token values live in `docs/superpowers/plans/2026-07-21-fintech-system-buildout-phase-b.md` (Canonical Token Sheet).
- Numerals: mono stack + `font-variant-numeric: tabular-nums` (use the `font-mono tabular-nums` utility pattern); icons stay lucide at default 2px stroke in-app EXCEPT where a task says otherwise (lucide's 2px is acceptable in-app; do NOT hand-redraw icons).
- i18n: keep every `t("...")` call; restyling must not drop translations. New user-visible strings added by redesign go through `locales/` if the screen is translated.
- Per-task verification: `npm run build` passes (zero new type errors), plus Chrome screenshot(s) of the affected screens at 1440×900 via localhost dev server, compared against the spec cards.
- Grep gate per swept file: no `#D4A853`/`#C49B3E`/other gold-blue hexes remain in files a task claims to sweep (token classes instead). `app/api/**` (email templates) is EXEMPT — out of scope.
- Do NOT delete `app/(dashboard)/payments/page 2.tsx` or `components/motion/page-transition 2.tsx` (stray duplicates — flagged to Charlie separately; leave them untouched).
- Commit per task on `staging`.

## Token Value Migration Table (Task 1 applies this to `app/globals.css` `:root`)

| Token (name kept) | Old | New |
|---|---|---|
| `--background` | #060A16 | #05080F |
| `--foreground` | #E2E8F0 | #E6EAF2 |
| `--foreground-secondary` | #94A3B8 | #8B95A9 |
| `--foreground-tertiary` | #64748B | #525D73 |
| `--foreground-quaternary` | #475569 | #475569 (unchanged) |
| `--surface-0` / `--surface-1` | #080C1A / #0B1022 | both #0A0F1C |
| `--surface-2` / `--surface-3` | #0F1629 / #151D33 | both #101728 |
| `--surface-4` / `--surface-overlay` | #1B2540 / #121A30 | both #151D33 |
| `--card` | #0F1629 | #0A0F1C |
| `--popover` | #121A30 | #151D33 |
| `--muted` / `--muted-foreground` | #0F1629 / #64748B | #101728 / #525D73 |
| `--border` / `--border-subtle` / `--border-strong` | 0.08 / 0.04 / 0.14 white alphas | 0.10 / 0.05 / 0.16 |
| `--input` | #0B1022 | #0A0F1C |
| gold ramp 50–800, `--primary`, `--accent`, `--ring` | — | unchanged (already canonical) |
| `--destructive` / `--destructive-foreground` | #DC2626 / #ffffff | match `system/components/buttons.html` destructive spec (extract exact values) |
| `--radius-md` / `--radius-lg` / `--radius` | 8px / 12px / 0.75rem | 10px / 14px / 10px |
| `--chart-1..5` | golds+blues | #D4A853 / #60A5FA / #34D399 / #A78BFA / #8B95A9 |
| ADD | — | `--emerald:#34D399; --emerald-dim:rgba(52,211,153,0.12); --red:#F87171; --red-dim:rgba(248,113,113,0.12); --amber:#FBBF24; --amber-dim:rgba(251,191,36,0.12); --blue-dim:rgba(96,165,250,0.12); --sh-gold:0 2px 12px rgba(212,168,83,0.18); --dur-micro:120ms; --dur-std:200ms; --dur-enter:320ms; --ease-out:cubic-bezier(0.2,0.8,0.2,1); --ease-spring:cubic-bezier(0.34,1.4,0.44,1)` (and `@theme inline` mappings for the color ones: `--color-emerald`, `--color-emerald-dim`, etc.) |

Shadows `--shadow-*`: replace with the canonical `--sh-sm/md/lg` values from the token sheet, keeping the old names as aliases (`--shadow-sm: var(--sh-sm)` style) so existing classes don't break.

---

### Task 1: Token port + global CSS + Toaster mount

**Files:**
- Modify: `app/globals.css` (values per the migration table; add missing tokens + `@theme inline` mappings; replace the shimmer keyframe with the canonical one from `system/foundations/motion.html`; keep all keyframes currently used by `components/landing/*`)
- Modify: `app/layout.tsx` (mount `<Toaster />` from `components/ui/toaster.tsx` — it is currently never rendered, so all `useToast()` calls silently no-op)
- Spec cards: `system/foundations/colors.html`, `typography.html`, `motion.html`

**Interfaces:**
- Produces: the token values every later task's classes resolve to; a working toast pipeline.

- [ ] **Step 1:** Apply the migration table to `:root`; add the new tokens and their `@theme inline` entries.
- [ ] **Step 2:** Replace the `shimmer` keyframe with the canonical spec (translateX(-100%)→100% overlay pattern) while keeping the existing `animate-shimmer` class name working; leave landing-page keyframes (float/glow) untouched.
- [ ] **Step 3:** Mount `<Toaster />` in `app/layout.tsx` inside the existing providers.
- [ ] **Step 4:** `npm run build` — passes. Dev-server screenshot of `/dashboard` and `/` — app renders with new palette, no broken styles.
- [ ] **Step 5:** Commit: `Phase C: token port, canonical shimmer, mount Toaster`

### Task 2: Primitives — actions & forms

**Files:**
- Modify: `components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `label.tsx`, `calendar.tsx`
- Spec cards: `system/components/buttons.html` (variants/sizes/states matrix + spec table), `forms.html`

**Interfaces:**
- Consumes: Task 1 tokens. Produces: the CVA variants every screen uses — keep existing variant/size prop names (`default`, `outline`, `ghost`, `destructive`, `secondary`, `sm`/`default`/`lg`) so no call sites break; heights sm 28px / default 34px / lg 40px; focus ring 2px `--ring`; label style 12px `--foreground-secondary` uppercase.

- [ ] **Step 1:** Rework `button.tsx` CVA to the buttons-card spec (bg/border/ink per state from its spec table; disabled/loading treatments; primary = solid gold, `#0A0F1C`-tier ink per card).
- [ ] **Step 2:** Rework the form controls to the forms-card spec (input focus/error, select panel on `--popover`, check/radio/switch checked = gold).
- [ ] **Step 3:** `npm run build`; screenshot `/login` and `/settings` (button+input heavy) against the cards.
- [ ] **Step 4:** Commit: `Phase C: action + form primitives to system spec`

### Task 3: Primitives — surfaces, status & data

**Files:**
- Modify: `components/ui/card.tsx`, `badge.tsx`, `table.tsx`, `progress.tsx`, `separator.tsx`, `scroll-area.tsx`, `tabs.tsx`, `accordion.tsx`, `avatar.tsx`
- Spec cards: `system/components/cards.html`, `feedback.html`, `navigation.html` (tabs), `system/patterns/tables.html`

**Interfaces:**
- Consumes: Task 1 tokens. Produces: `Card` gains a `featured` variant (gold top hairline + `--sh-gold`) alongside existing `default`/`elevated`; `Badge` gains semantic variants used later: `success` (emerald), `warning` (amber), `live` (red pulse dot), `gold`, `locked` (outline) — keep existing variant names working; `Table` gets dense 40px rows, uppercase `--t-xs`-style header, hover wash, right-aligned mono numeral cell helper class.

- [ ] **Step 1:** Card/separator/scroll-area/accordion per cards.html; tabs per navigation.html (gold underline active).
- [ ] **Step 2:** Badge variants + avatar per feedback.html (incl. the pulse-dot LIVE treatment as a variant); progress per feedback.html.
- [ ] **Step 3:** Table per tables.html.
- [ ] **Step 4:** `npm run build`; screenshot `/team` (table+badges) and `/dashboard`.
- [ ] **Step 5:** Commit: `Phase C: surface + status + table primitives to system spec`

### Task 4: Primitives — overlays & toast

**Files:**
- Modify: `components/ui/dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `toast.tsx`
- Spec cards: `system/components/overlays.html`, `feedback.html` (toast semantics)

**Interfaces:**
- Consumes: Task 1 tokens + Task 2 buttons. Produces: overlay panels on `--popover`/`--surface-overlay` with `--sh-lg`, backdrop rgba(0,0,0,0.6); toast variants success/error/info/warning matching feedback.html (icon + status border + dim wash) — extend the existing toast variant API additively.

- [ ] **Step 1:** Dialog/alert-dialog/popover/dropdown/tooltip per overlays.html.
- [ ] **Step 2:** Toast per feedback.html; verify a toast fires visibly (admin privileges page uses `useToast` — trigger via a temporary dev-only render if needed, then remove).
- [ ] **Step 3:** `npm run build`; screenshot a dialog (settings has several) against the card.
- [ ] **Step 4:** Commit: `Phase C: overlay + toast primitives to system spec`

### Task 5: New shared components — charts, tiles, states, moments

**Files:**
- Create: `components/charts/sparkline.tsx`, `area-chart.tsx`, `bar-chart.tsx`, `donut-chart.tsx` (small dependency-free React SVG components: typed props `{data: number[], ...}`, coordinate math per the card's printed specs, endpoint headroom rule, gridlines at `--border-subtle`, tabular mono labels)
- Create: `components/patterns/stat-tile.tsx` (label / mono value / delta chip / optional sparkline — per cards.html spec), `empty-state.tsx` (icon/title/desc/CTA slots), `skeleton.tsx` (stat-tile, table-row, class-card variants sharing the canonical shimmer), `celebration.tsx` (RankUpCard + PayoutHero, one-shot animations per moments.html)
- Spec cards: `system/patterns/charts.html`, `states.html`, `moments.html`, `system/components/cards.html`

**Interfaces:**
- Produces (exact): `<Sparkline data={number[]} width? height?/>`, `<AreaChart data={number[]} labels={string[]}/>`, `<BarChart data={number[]} labels={string[]} highlightIndex?/>`, `<DonutChart segments={{value:number,color:string}[]} centerLabel={string}/>`, `<StatTile label value delta? deltaDirection? sparklineData? footnote?/>`, `<EmptyState icon title description? action?/>`, `<SkeletonTile/>`/`<SkeletonRows n/>`/`<SkeletonClassCard/>`, `<RankUpCard rankName/>`, `<PayoutHero amount txHash/>`.

- [ ] **Step 1:** Charts (port the cards' SVG math into parameterized components; verify with the cards' exact series as fixtures on a scratch page, then remove the scratch page).
- [ ] **Step 2:** StatTile, EmptyState, Skeletons, Celebration components.
- [ ] **Step 3:** `npm run build`; screenshot the scratch-verification of each component before removing it.
- [ ] **Step 4:** Commit: `Phase C: chart, tile, state, and moment components`

### Task 6: App shell — sidebar, headers

**Files:**
- Modify: `components/sidebar.tsx` (446 lines, 73 arbitrary values — restyle to `system/components/navigation.html`: 240px/64px-rail treatments, active gold left-bar, user chip; keep ALL existing nav logic, admin sections, collapse behavior, i18n), `dashboard-header.tsx`, `page-header.tsx`, `section-header.tsx`, `loading-spinner.tsx`
- Spec cards: `system/components/navigation.html`, `foundations/motion.html` (spinner)

- [ ] **Step 1:** Sidebar sweep (tokens/classes only; grep gate on the file after).
- [ ] **Step 2:** Headers + spinner.
- [ ] **Step 3:** `npm run build`; screenshots expanded + collapsed sidebar, admin section open.
- [ ] **Step 4:** Commit: `Phase C: app shell to system spec`

### Task 7: Dashboard screen

**Files:**
- Modify: `app/(dashboard)/dashboard/dashboard-client.tsx` (799 lines), `components/bypass-access-banner.tsx`, `components/account-status-card.tsx`, `components/global-banner.tsx`, `components/inactive-account-banner.tsx`, `components/missing-wallet-banner.tsx`
- Spec cards: `system/patterns/app-signatures.html` (KPI row, structure selector, class cards, wallet card), `charts.html`, `states.html`

**Interfaces:**
- Consumes: StatTile/Sparkline/Skeleton/EmptyState from Task 5, primitives from Tasks 2-4.

- [ ] **Step 1:** Stats grid → 4 `<StatTile>` with sparklines fed from existing data (sparkline series: reuse whatever historical data the component already has; if none exists, omit the sparkline rather than inventing data — no new data fetching).
- [ ] **Step 2:** Structure selector + academy schedule + wallet card restyled per app-signatures.html; loading → skeletons; empty classes → `<EmptyState>`.
- [ ] **Step 3:** Banners swept to token classes.
- [ ] **Step 4:** Grep gate on all files; `npm run build`; screenshots vs app-signatures card.
- [ ] **Step 5:** Commit: `Phase C: dashboard screen to system spec`

### Task 8: Finance + payments screens (fund-safety spotlight)

**Files:**
- Modify: `app/(dashboard)/finance/page.tsx` (791), `app/(dashboard)/payments/page.tsx` (752), `components/crypto/PayoutWalletSetup.tsx`, `components/crypto/UnifiedTransactionHistory.tsx`, `components/payment-schedule-selector.tsx`
- Spec cards: `app-signatures.html` (wallet), `tables.html` (transaction history), `states.html`, `moments.html` (payout success states)

**Extra constraint:** these files contain payment flows. The diff must be reviewable as pure presentation: no changed identifiers in handlers, no reordered effects, no touched fetch/AbortController/amount logic. NOT the `page 2.tsx` file.

- [ ] **Step 1:** Finance page (wallet card, payout history table, balances as StatTiles).
- [ ] **Step 2:** Payments page + schedule selector + crypto components.
- [ ] **Step 3:** Grep gate; `npm run build`; screenshots; manually diff-review that no logic lines changed before committing.
- [ ] **Step 4:** Commit: `Phase C: finance + payments screens to system spec (visual-only)`

### Task 9: Academy + team + referrals screens

**Files:**
- Modify: `app/(dashboard)/academy/page.tsx` (330), `components/academy/*` (5 files), `app/(dashboard)/team/page.tsx` (804), `components/team/*` (5 files — in `team-tree-visualization.tsx` only tokenize hardcoded colors incl. reactflow edge `stroke: '#D4A853'` → resolved token value; do not restructure the canvas), `app/(dashboard)/referrals/page.tsx` (360), `components/referral/confirm-referral-modal.tsx`
- Spec cards: `app-signatures.html` (class cards), `tables.html`, `feedback.html` (rank badges — port the 7-rank gold-scaling treatment where ranks render), `states.html`

- [ ] **Step 1:** Academy + components (class cards per spec; live indicator uses Badge `live` variant).
- [ ] **Step 2:** Team (dense table per spec, rank badges, tree tokenized) + referrals.
- [ ] **Step 3:** Grep gate; `npm run build`; screenshots.
- [ ] **Step 4:** Commit: `Phase C: academy, team, referrals to system spec`

### Task 10: Settings + notifications + auth screens

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx` (1004), `app/(dashboard)/notifications/page.tsx` (655), `components/mfa/*` (3), `app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `complete-signup/page.tsx`, `mfa-verify/page.tsx`
- Spec cards: `forms.html`, `feedback.html` + `app-signatures.html` notifications list (unread dots, semantic icon tiles), `moments.html` (onboarding welcome for register/complete-signup)

- [ ] **Step 1:** Settings + MFA components (forms spec).
- [ ] **Step 2:** Notifications screen per the app-signatures notifications list.
- [ ] **Step 3:** Auth screens (forms spec; register/complete-signup get the onboarding-hero treatment).
- [ ] **Step 4:** Grep gate; `npm run build`; screenshots.
- [ ] **Step 5:** Commit: `Phase C: settings, notifications, auth to system spec`

### Task 11: Admin batch 1 — financial admin

**Files:**
- Modify: `app/(dashboard)/admin/financials/page.tsx` (2343 — styling-only sweep, no refactor), `admin/payouts/page.tsx` (671), `admin/transaction-logs/page.tsx` (474), `admin/direct-bonuses/page.tsx` (639), `components/admin/manual-payout-dialog.tsx`, `skip-payment-dialog.tsx`
- Spec cards: `tables.html`, `charts.html` (StatTiles for the summary numbers), `overlays.html`

**Extra constraint:** same fund-safety rule as Task 8 — these pages trigger payouts.

- [ ] **Step 1:** Financials (StatTiles + dense tables; the 48 hexes → tokens).
- [ ] **Step 2:** Payouts, transaction-logs, direct-bonuses + the two dialogs.
- [ ] **Step 3:** Grep gate; `npm run build`; screenshots; logic-diff review before commit.
- [ ] **Step 4:** Commit: `Phase C: admin financial screens to system spec (visual-only)`

### Task 12: Admin batch 2 — network & content admin

**Files:**
- Modify: `admin/network/page.tsx` (2001), `admin/network-visualizer/network-visualizer-client.tsx` (759), `admin/classes/page.tsx` (867), `admin/academy-manager/page.tsx` (1067 — replace its 14 raw bordered divs with Card), `admin/notifications/page.tsx` (542), `admin/flagged-reviews/page.tsx` (486), `admin/privileges/privileges-client.tsx` (266), `components/admin/reassign-position-dialog.tsx`, `reset-password-dialog.tsx`, `user-search-combobox.tsx`
- Spec cards: `tables.html`, `cards.html`, `overlays.html`, `feedback.html`

- [ ] **Step 1:** Network + visualizer. **Step 2:** Classes + academy-manager. **Step 3:** Notifications + flagged-reviews + privileges + dialogs.
- [ ] **Step 4:** Grep gate; `npm run build`; screenshots.
- [ ] **Step 5:** Commit: `Phase C: admin network + content screens to system spec`

### Task 13: Landing + payment/ref pages

**Files:**
- Modify: `app/page.tsx` + `components/landing/*` (9 files — retune to new tokens; the landing may keep its marketing drama (gradients/glow) but colors/radii/type must resolve to tokens), `app/payment/complete/page.tsx` (use `<PayoutHero>`-style success moment per moments.html), `app/ref/[slug]/page.tsx`
- Spec cards: `moments.html`, `foundations/colors.html`

- [ ] **Step 1:** Landing sweep. **Step 2:** payment/complete + ref pages.
- [ ] **Step 3:** Grep gate; `npm run build`; screenshots.
- [ ] **Step 4:** Commit: `Phase C: landing + payment + ref pages to system spec`

### Task 14: Final sweep & verification

- [ ] **Step 1:** Repo-wide grep (excluding `app/api/**`, `docs/**`, `node_modules`): `#D4A853|#C49B3E|#060A16|#0F1629|#121A30|#0B1022` → every remaining hit is either in an exempt path or individually justified in the report.
- [ ] **Step 2:** `npm run build` clean; dev-server screenshot pass of every route in the screen inventory at 1440×900; fix anything broken.
- [ ] **Step 3:** Verify dead-code report for Charlie (do not act): `tooltip`/`navigation-menu`/`alert` primitives now used or still dead; `page 2.tsx` duplicates; theme-toggle scaffolding.
- [ ] **Step 4:** Commit: `Phase C: final sweep`
