# Travtools

Traveller tabletop RPG companion tools for the 2022 Core Rulebook edition.

The main app is a React/Vite single-page app deployed to GitHub Pages and backed by Supabase for shared realtime state across the table.

Live app:

https://gruevyhat.github.io/travtools/

## Fan Tool Notice

Travtools is an unofficial, non-commercial fan tool for a private Traveller tabletop campaign. It is not affiliated with, sponsored by, or endorsed by Mongoose Publishing.

Core Rulebook front matter credits include Classic Traveller by Marc Miller, Mongoose Traveller development by Matthew Sprange, and original core mechanics by Gareth Hanrahan.

Copyright notice from the Core Rulebook: `Traveller ©2026 Mongoose Publishing Ltd. All rights reserved.` Traveller is identified in the rulebook as a registered trademark of Mongoose Publishing Ltd.

## Current Features

- **Landing dashboard** - live module counts, module launch buttons, latest roll summary, and Traveller ship-plan visual treatment.
- **Party Roster** - Traveller XLSX import/refresh, manual character entry, portraits, expanded UPP display, skill/weapon/psionic rolls, health/PSI/temp modifier trackers, contacts, finances, background/personality fields, and imported sheet sections.
- **NPCs** - quick NPC generation, saved NPC records, race/archetype/experience/quirk ribbons, rollable characteristics and skills, and roster-style roll modal behavior.
- **Ships: Fleet** - canonical ship deck plans, custom schematic uploads, click annotations, notes, editable ship specs, and custom image replacement.
- **Ships: Shipyard** - guided spacecraft builder with canonical presets, running tonnage/power/cost checks, Supabase persistence, diagram upload, JSON export, and Add to Fleet.
- **Trade Ledger** - speculative cargo deals, active/completed/cancelled flow, world filter, CSV import/export, profit/loss summaries, and Core Rules trade goods reference.
- **Trade Mini-Game** - in-progress trade-session, passenger, freight, and mail workflows based on the development plan.
- **Inventory Manager** - party inventory list, filters, totals, inline quantity changes, bulk delete, and Core Rules equipment reference panel.
- **Roll Log** - shared roll history with per-character filtering, pagination, realtime updates, and clear-log confirmation.
- **Global Tools Drawer** - Traveller 2D6 roller, boon/bane support, flux dice, arbitrary dice notation, trade goods roller, difficulty reminders, task-chain reminder, and quick reference.
- **Session Journal** - shared session notes with create/edit/delete and realtime sync.
- **Combat Tracker** - implemented but currently disabled in navigation while hardening remains paused.

## Current Status

Milestones 0-5 are largely complete. Mobile/resilience polish, campaign-depth features, Shipyard hardening, and the full trade mini-game are active areas in `plans/development-plan.md`.

The app has an active Vitest suite plus a Playwright smoke script covering critical flows such as landing, ships/fleet, Shipyard, roster, trade, inventory, global tools, and roll log behavior.

## Repository Layout

- `apps/travtools-web/` - React 18 + Vite + TypeScript + Tailwind SPA
- `apps/travtools-web/src/components/` - app modules and UI components
- `apps/travtools-web/src/data/` - local typed Traveller reference data used by the app
- `apps/travtools-web/src/lib/` - shared dice, trade, ship-builder, CSV, XLSX, inventory, and Supabase logic
- `apps/travtools-web/src/__tests__/` - Vitest and React Testing Library tests
- `apps/travtools-web/scripts/e2e-smoke.mjs` - Playwright smoke test
- `apps/travtools-web/scripts/reimport-characters.ts` - bulk reimport local XLSX character sheets into Supabase
- `apps/travtools-web/supabase/schema.sql` - Supabase table, RLS, and Storage setup
- `plans/development-plan.md` - milestone plan and remaining work
- `docs/` - local Traveller reference material and character XLSX files; PDFs are ignored by git
- `data/` - local campaign JSON snapshots

## Local Setup

Run commands from `apps/travtools-web/`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The development server is served under `/travtools/`, matching the GitHub Pages base path:

```text
http://localhost:5173/travtools/
```

Fill `.env.local` with:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

If build-time env vars are absent, the app shows a setup screen and stores Supabase credentials in `localStorage`.

## Supabase Setup

1. Create a Supabase project.
2. Run `apps/travtools-web/supabase/schema.sql` in the SQL editor.
3. Create or verify a public Storage bucket named `ship-schematics` for custom ship schematic and Shipyard diagram uploads.
4. Add GitHub repository secrets for deployment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

The schema currently includes shared tables for characters, NPCs, ships, ship designs, trade deals, inventory items, roll log entries, and session journal notes. It uses anon read/write RLS policies for a trusted private group.

Character portraits are stored as data URLs in the `characters` table and do not require the Storage bucket.

Known setup note: the current development plan flags the Storage policy statements in `schema.sql` for hardening because `CREATE POLICY IF NOT EXISTS` is not valid Postgres syntax. If a fresh Supabase SQL-editor run fails there, replace those policy statements with `DROP POLICY IF EXISTS` plus `CREATE POLICY`, or a guarded `DO` block.

## Scripts

```bash
npm run dev       # start Vite dev server at http://localhost:5173/travtools/
npm run lint      # ESLint
npm test          # Vitest test suite
npm run build     # TypeScript check + Vite production build
npm run preview   # preview production build
npm run test:e2e  # Playwright smoke test script
```

Bulk reimport local character XLSX files into the configured Supabase project:

```bash
./node_modules/.bin/vite-node --script scripts/reimport-characters.ts
```

The reimport script reads `docs/characters/*.xlsx`, updates existing rows by character name/player when possible, preserves existing portrait URLs, and inserts only when no match exists.

## Deployment

GitHub Pages deploys through `.github/workflows/deploy.yml` on every push to `main`.

The workflow:

1. Runs `npm ci`
2. Runs `npm test`
3. Runs `npm run build`
4. Uploads `apps/travtools-web/dist`
5. Deploys to GitHub Pages

The app uses `HashRouter`, so routes work under the `/travtools/` GitHub Pages base path without a custom 404 page.

## Design

The app uses a Traveller space-western terminal aesthetic:

- Void background: `#080C14`
- Amber terminal text: `#D4A017`
- Cyan data readouts: `#1FB8CD`
- `Share Tech Mono` and `Rajdhani`
- Subtle CRT scan-line overlay

Keep new UI consistent with existing Tailwind helpers such as `bg-void`, `text-amber`, `text-cyan-trav`, `panel`, `btn-amber`, `btn-steel`, `input`, and `select`.
