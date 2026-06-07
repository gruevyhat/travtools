# Travtools

Traveller tabletop RPG companion tools for the 2022 Core Rulebook edition.

The main app is a React/Vite single-page app deployed to GitHub Pages and backed by Supabase for shared realtime state across the table.

Live app:

https://gruevyhat.github.io/travtools/

## Current Features

- **Landing dashboard** — first screen with live counts, module launch buttons, latest roll summary, and Traveller ship-plan visual treatment.
- **Party Roster** — Traveller XLSX import/refresh, manual character entry, portraits, expanded UPP display, skill and weapon rolls, health/PSI/temp modifier trackers, contacts, finances, background/personality fields, and imported sheet sections.
- **Ship Schematic Viewer** — canonical ship deck plans, custom schematic upload, click annotations, notes, and ship specs.
- **Trade Ledger** — speculative cargo deals, active/completed/cancelled flow, world filter, CSV export, profit/loss summaries, and Core Rules trade goods reference.
- **Inventory Manager** — party inventory list, filters, totals, inline quantity changes, bulk delete, and Core Rules equipment reference panel.
- **Roll Log** — shared roll history with clear-log action.
- **Global Tools Drawer** — standalone dice roller, boon/bane support, difficulty reminders, task-chain reminder, and quick reference.

## Repository Layout

- `apps/travtools-web/` — React 18 + Vite + TypeScript + Tailwind SPA
- `apps/travtools-web/supabase/schema.sql` — Supabase table and RLS setup
- `apps/travtools-web/scripts/reimport-characters.ts` — bulk reimport local XLSX character sheets into Supabase
- `plans/development-plan.md` — milestone plan and remaining work
- `docs/` — local Traveller reference material and character XLSX files; PDFs are ignored by git

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
3. Create a public Storage bucket named `ship-schematics` for custom ship schematic uploads.
4. Add GitHub repository secrets for deployment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Character portraits are stored as data URLs in the `characters` table and do not require the Storage bucket.

## Scripts

```bash
npm run dev       # start Vite dev server
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

Keep new UI consistent with existing Tailwind helpers such as `bg-void`, `text-amber`, `text-cyan-trav`, `panel`, `btn-amber`, and `btn-steel`.
