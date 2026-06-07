# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

`travtools` is a tooling project for the Traveller tabletop RPG (2022 Core Rulebook edition). The reference rulebook is at `docs/Traveller 2022 Core Rulebook 20-02-2026.pdf`.

## Repository Structure

- `apps/travtools-web/` — React/Vite SPA (the main group companion app)
- `apps/travtools-web/scripts/reimport-characters.ts` — bulk reimport local character XLSX files into Supabase
- `src/` — shared library code (unused for now)
- `test/` — tests (unused for now)
- `docs/` — reference material (Traveller 2022 Core Rulebook PDF)
- `plans/` — milestone plan and remaining work

## App: travtools-web

A React 18 + Vite + TypeScript + Tailwind CSS SPA deployed to GitHub Pages. Uses Supabase for shared real-time data sync across all group members.

### Features

1. **Landing Dashboard** — live module counts, latest roll summary, and module launch controls
2. **Party Roster** — Traveller XLSX import/refresh, manual entry, portraits, imported profile/homeworld/lifepath/background/contact data, health/PSI/temp modifier trackers, and integrated rolls
3. **Ship Schematic Viewer** — canonical SVG deck plans, custom image upload, ship specs, notes, and click-to-annotate labels
4. **Trade Ledger** — speculative cargo deals, buy/sell flow, profit/loss, world filters, CSV export, and Core Rules trade goods reference
5. **Inventory Manager** — party equipment list, owner/category filters, totals, inline quantity controls, bulk delete, and Core Rules equipment reference
6. **Roll Log** — shared roll history with clear-log action
7. **Global Tools Drawer** — standalone dice roller, boon/bane, difficulty reminders, task-chain reminder, and quick reference

### Commands (run from `apps/travtools-web/`)

```bash
npm run dev       # start dev server at http://localhost:5173/travtools/
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # preview production build
npm run lint      # ESLint
npm test          # Vitest test suite
npm run test:e2e  # Playwright smoke test
```

Bulk reimport local XLSX character sheets into the configured Supabase project:

```bash
./node_modules/.bin/vite-node --script scripts/reimport-characters.ts
```

### Setup

1. Create a free [Supabase](https://supabase.com) project
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. Create a Storage bucket named `ship-schematics` (Public) in Supabase Dashboard for custom ship schematic uploads
4. Copy `.env.example` to `.env.local` and fill in your project URL and anon key
5. Run `npm run dev`

Character portraits are stored as data URLs in the `characters` table and do not require the Storage bucket.

### GitHub Pages Deployment

The GH Actions workflow at `.github/workflows/deploy.yml` builds and deploys on push to `main`.

Add two repository secrets:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your project anon key

The app is served under `/travtools/` (matches `base` in `vite.config.ts`).

Published app: https://gruevyhat.github.io/travtools/

### Key Design Decisions

- **HashRouter** for SPA routing (no 404.html hack needed on GitHub Pages)
- **Supabase realtime** subscriptions keep all clients in sync live
- **Anon RLS policies** — all users share one namespace; tighten with Supabase Auth if needed
- **Runtime Supabase config** — if env vars are not baked in at build time, the app shows a setup screen and stores credentials in `localStorage`
- **Traveller XLSX import** is the primary roster import path; CSV remains a parser/export utility
- **Core Rules references** are local typed data files in `src/data/`, not fetched at runtime

### Aesthetic

Traveller space-western terminal aesthetic: dark `#080C14` void background, amber `#D4A017` terminal text, cyan `#1FB8CD` data readouts, `Share Tech Mono` font, subtle CRT scan-line overlay.
