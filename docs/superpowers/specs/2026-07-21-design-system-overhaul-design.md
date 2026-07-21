# Snipers Trading Academy — Design System Overhaul

**Date:** 2026-07-21
**Status:** Approved by Charlie (brainstorming session)
**Repo:** `tradinghub` (product name is **Snipers Trading Academy** — always use the product name in user-facing work)

## Goal

Drastically elevate the app's visual design and UX while keeping its navy + gold identity. Fill out the missing pieces of the design system (richer visual elements, more component variants and states), then apply the improved system to **every screen** in the app.

## Current state

- Next.js 15 (App Router), Tailwind CSS 4, shadcn/ui (Radix + CVA), `next-themes`, framer-motion, lucide icons.
- Dark-only theme defined in `app/globals.css`: navy background (`#060A16`), 8-stop gold palette (primary `#D4A853`), opaque surface elevation tiers (`--surface-0`–`--surface-4`), tiered borders, layered + gold shadows, glass overlay utility, shimmer/glow/float keyframes.
- 26 shadcn components in `components/ui/`.
- Screens: `(auth)` (login, register, MFA, password flows), `(dashboard)` (dashboard, academy, finance, payments, referrals, team, settings, notifications, admin), plus landing page, payment, and ref routes.

What's lacking (per Charlie): the system needs to feel dramatically more premium; it's missing visual elements and patterns (chart styles, empty states, dense tables, loading/skeleton states, celebration moments, richer variants).

## Decisions made

| Question | Decision |
|---|---|
| Nature of improvement | Elevate the existing navy + gold identity (not a new palette) + fill missing pieces + richer visual elements |
| Scope | Design-system layer **and** all app screens |
| Workflow | **Claude Design first**: build and iterate visually in a Claude Design project on claude.ai, port to code only after approval |
| Visual direction | Undecided — present 3 directions as previews and pick from what's seen |
| Direction showcase canvas | Dashboard home (mirroring real content, not lorem ipsum) |

## Phase A — Direction exploration (Claude Design)

1. Create a new Claude Design project: **"Snipers Trading Academy Design System"** (via DesignSync `create_project`).
2. Build three distinct visual directions, each keeping navy + gold but interpreting it differently:
   - **Private-bank luxury** — restrained gold, refined display typography, generous space, quiet confidence.
   - **Modern fintech pro** — crisp, data-dense, sharp type, glowing accents, slick charts.
   - **Rich & cinematic** — controlled drama: animated gradients, glass, depth, glow.
3. Each direction ships as two self-contained HTML preview cards:
   - A full mocked-up **dashboard home** reflecting the real dashboard's actual content, nav, and the Snipers Trading Academy name/branding (read the real page first).
   - A **core component sheet**: buttons, cards, stat tiles, inputs, badges.
4. Push via DesignSync (list → finalize_plan → write_files). Charlie reviews side-by-side on claude.ai/design and picks a winner or a hybrid (e.g. one direction's typography with another's depth).

The "Snipers" identity (precision, crosshair motifs, marksman restraint) is fair game as a motif in any direction.

**Exit criterion:** Charlie names a winning direction (or hybrid recipe).

## Phase B — Full system build-out (Claude Design)

Expand the winning direction into the complete improved system as browsable grouped preview cards:

- **Foundations:** color tokens, typography scale, spacing, radius, shadows/elevation, motion principles.
- **Components:** every existing component upgraded with variants and states (hover/focus/disabled/loading).
- **New pieces the current system lacks:** chart styles, empty states, dense data tables, notification/toast patterns, loading and skeleton states, hero/celebration moments.

Iterate in Claude Design until Charlie approves.

**Exit criterion:** Charlie approves the full system on claude.ai/design.

## Phase C — Port to code

Only after Phase B approval:

1. Update `app/globals.css` tokens and utilities to match the approved system.
2. Upgrade the shadcn components in `components/ui/` to match.
3. Sweep the app in batches, verifying each visually before moving on:
   dashboard → finance/payments → academy → referrals/team → settings/notifications → admin → auth (+ landing/payment/ref pages).

**Fund-safety note:** this project is purely visual. No changes to payment logic, payout paths, or anything that can move funds.

## Non-goals

- No light theme (system stays dark-only unless Charlie asks).
- No palette replacement — navy + gold stays.
- No backend, data, or business-logic changes.

## Plan structure

Phase A gets an implementation plan now. Phases B and C each get their own implementation plan when reached (B's content depends on A's winner; C's depends on B's approved system).
