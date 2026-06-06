# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`travtools` is a tooling project for the Traveller tabletop RPG (2022 Core Rulebook edition). The reference rulebook is at `docs/Traveller 2022 Core Rulebook 20-02-2026.pdf`.

## Repository Structure

- `apps/travtools-web/` — React/Vite SPA (the main group companion app)
- `src/` — shared library code (unused for now)
- `test/` — tests (unused for now)
- `docs/` — reference material (Traveller 2022 Core Rulebook PDF)

## App: travtools-web

A React 18 + Vite + TypeScript + Tailwind CSS SPA deployed to GitHub Pages. Uses Supabase for shared real-time data sync across all group members.

### Features

1. **Ship Schematic Viewer** — canonical SVG deck plans (Type-S, Type-A) + custom image upload with click-to-annotate labels
2. **Trade Ledger** — track speculative cargo deals with buy/sell prices, profit/loss, and world records
3. **Inventory Manager** — party equipment list with weight, value, owner, and category filters
4. **Party Roster** — character cards showing UPP + skills; CSV import or manual entry

### Commands (run from `apps/travtools-web/`)

```bash
npm run dev       # start dev server at http://localhost:5173/travtools/
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # preview production build
npm run lint      # ESLint
```

### Setup

1. Create a free [Supabase](https://supabase.com) project
2. Run `supabase/schema.sql` in the Supabase SQL editor
3. Create a Storage bucket named `ship-schematics` (Public) in Supabase Dashboard
4. Copy `.env.example` to `.env.local` and fill in your project URL and anon key
5. Run `npm run dev`

### GitHub Pages Deployment

The GH Actions workflow at `.github/workflows/deploy.yml` builds and deploys on push to `main`.

Add two repository secrets:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your project anon key

The app is served under `/travtools/` (matches `base` in `vite.config.ts`).

### Key Design Decisions

- **HashRouter** for SPA routing (no 404.html hack needed on GitHub Pages)
- **Supabase realtime** subscriptions keep all clients in sync live
- **Anon RLS policies** — all users share one namespace; tighten with Supabase Auth if needed
- **Runtime Supabase config** — if env vars are not baked in at build time, the app shows a setup screen and stores credentials in `localStorage`

### Aesthetic

Traveller space-western terminal aesthetic: dark `#080C14` void background, amber `#D4A017` terminal text, cyan `#1FB8CD` data readouts, `Share Tech Mono` font, subtle CRT scan-line overlay.
