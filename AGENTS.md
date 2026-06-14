# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

`travtools` is a private Traveller tabletop RPG group companion app for the 2022 Core Rulebook edition. The reference rulebook is at `docs/Traveller 2022 Core Rulebook 20-02-2026.pdf`.

Travtools is an unofficial fan tool for a private campaign. It is not affiliated with, sponsored by, or endorsed by Mongoose Publishing. Core Rulebook front matter credits include Classic Traveller by Marc Miller, Mongoose Traveller development by Matthew Sprange, and original core mechanics by Gareth Hanrahan. The Core Rulebook copyright notice is: `Traveller ©2026 Mongoose Publishing Ltd. All rights reserved.`

## Current Status

The main app is live at `https://gruevyhat.github.io/travtools/` and is deployed as a static GitHub Pages SPA under `/travtools/`. It uses Supabase for shared realtime state.

The active app now includes:

1. **Landing Dashboard** — realtime module counts, launch controls, latest roll summary, and Traveller ship-plan visual treatment.
2. **Party Roster** — Traveller XLSX import/refresh, manual character entry, portraits, expanded UPP display, health/PSI/temp modifier trackers, imported profile/homeworld/lifepath/background/contact data, and integrated rolls.
3. **NPCs** — quick NPC generation, saved NPC records, race/archetype/experience/quirk display, rollable characteristics and skills, and shared roll modal behavior.
4. **Ships** — a combined SHIPS module with **Fleet** and **Shipyard** tabs.
   - Fleet: canonical deck plans, custom schematic uploads, annotations, notes, editable ship specs, and custom image replacement.
   - Shipyard: guided spacecraft builder, canonical presets, running tonnage/power/cost checks, Supabase persistence, diagram upload, JSON export, and Add to Fleet.
5. **Trade** — speculative cargo ledger with deal lifecycle, world filters, CSV import/export, Core Rules trade goods reference, and in-progress trade-session/passenger/freight tooling.
6. **Inventory** — party equipment list, owner/category filters, totals, inline quantity controls, bulk delete, and Core Rules equipment reference.
7. **Roll Log** — shared roll history, per-character filtering, pagination, clear-log confirmation, and realtime updates.
8. **Global Tools Drawer** — Traveller 2D6 roller, boon/bane, flux dice, arbitrary dice notation via `@dice-roller/rpg-dice-roller`, trade goods roller, difficulty/task-chain reminders, and reference material.
9. **Session Journal** — shared session notes with create/edit/delete and realtime sync.
10. **Combat** — implemented but currently disabled behind `COMBAT_MODULE_DISABLED`; do not re-enable without an explicit task to finish/verify it.

Recent committed work added the Shipyard/Fleet integration and expanded NPC polish. The development plan tracks Milestone 9 Ship Builder hardening and Milestone 11 trade mini-game work as active/in-progress areas.

## Repository Structure

- `apps/travtools-web/` — React 18 + Vite + TypeScript + Tailwind SPA; this is the only active app.
- `apps/travtools-web/src/components/` — route modules and shared UI components.
- `apps/travtools-web/src/data/` — local typed Traveller reference data used at runtime; do not fetch rule data dynamically.
- `apps/travtools-web/src/lib/` — shared app logic, dice/trade/ship-builder utilities, and Supabase context.
- `apps/travtools-web/src/__tests__/` — Vitest and React Testing Library tests.
- `apps/travtools-web/scripts/e2e-smoke.mjs` — Playwright smoke test.
- `apps/travtools-web/scripts/reimport-characters.ts` — bulk reimport local XLSX character sheets into Supabase.
- `apps/travtools-web/supabase/schema.sql` — Supabase tables, RLS policies, and Storage bucket setup.
- `plans/development-plan.md` — milestone plan, current status, and remaining work.
- `docs/` — local reference material and character XLSX files. PDFs are ignored by git.
- `data/` — local campaign JSON snapshots; treat as local campaign data unless the user explicitly asks to commit or modify them.
- Root `src/` and `test/` are currently unused placeholders.

## Commands

Run app commands from `apps/travtools-web/`.

```bash
npm run dev       # start dev server at http://localhost:5173/travtools/
npm run build     # TypeScript check + Vite production build -> dist/
npm run preview   # preview production build
npm run lint      # ESLint
npm test          # Vitest test suite
npm run test:e2e  # Playwright smoke test
```

Bulk reimport local XLSX character sheets into the configured Supabase project:

```bash
./node_modules/.bin/vite-node --script scripts/reimport-characters.ts
```

## Setup And Deployment

1. Create a Supabase project.
2. Run `apps/travtools-web/supabase/schema.sql` in the Supabase SQL editor.
3. Create or verify a public Storage bucket named `ship-schematics` for custom ship schematic and Shipyard diagram uploads.
4. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Run `npm run dev`.

Character portraits are stored as data URLs in the `characters` table and do not require the Storage bucket.

The GitHub Actions workflow at `.github/workflows/deploy.yml` builds and deploys on push to `main`. The app uses `HashRouter`, so GitHub Pages routes work under the `/travtools/` base path without a custom `404.html`.

Add these repository secrets for production deploys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase Notes

The schema uses anonymous RLS policies for a trusted private group. All users share one namespace; add Supabase Auth before exposing this as a public multi-group app.

Important tables currently include `characters`, `npcs`, `ships`, `ship_designs`, `trade_deals`, `inventory_items`, `roll_log`, and `session_journal`.

The current development plan flags one schema hardening item: `CREATE POLICY IF NOT EXISTS` is not valid Postgres syntax for Storage policies in `supabase/schema.sql`. If working on setup/schema, replace those policy statements with `DROP POLICY IF EXISTS` plus `CREATE POLICY`, or a guarded `DO` block, before relying on a fresh Supabase SQL-editor run.

## Engineering Guidance

- Follow the existing React/Tailwind style and route/module boundaries.
- New pure logic should ship with focused Vitest coverage. Bug fixes should get a reproduction test first when practical.
- Preserve realtime behavior when changing Supabase-backed modules; update local optimistic state and subscription behavior deliberately.
- Keep Traveller rule references in typed local data files under `src/data/`.
- Do not paste large rulebook excerpts into source or docs. Use concise, derived tables or summaries already represented in code.
- Treat `docs/characters/*.xlsx` and `data/*.json` as campaign data. Do not delete, rewrite, or commit them unless the user explicitly asks.
- Leave unrelated dirty worktree changes alone.

## Known Active Work

- **Milestone 6:** mobile/resilience polish, PartyRoster extraction, background grouping, initiative-for-all.
- **Milestone 9:** Ship Builder hardening: Storage policy SQL, over-tonnage warnings, dispersed hull HP multiplier, Add to Fleet error handling, and more tests.
- **Milestone 10:** party treasury and loot shares.
- **Milestone 11:** full trade mini-game: trade session workflow, passengers, freight, mail, and audited modified-price behavior.
- **Milestone 12:** ammunition tracking.

## Aesthetic

Traveller space-western terminal aesthetic: dark `#080C14` void background, amber `#D4A017` terminal text, cyan `#1FB8CD` data readouts, `Share Tech Mono` / `Rajdhani` typography, and subtle CRT scan-line overlay.
