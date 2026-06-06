# Travtools Development Plan

## Overview

A group companion app for Traveller RPG (2022 Core Rulebook edition), runnable as a GitHub Pages SPA. Shared real-time state via Supabase. Aesthetic: dark void terminal, amber text, cyan data readouts, CRT scan-lines — the Firefly/Serenity bridge feel.

### Current State (as of plan creation)

All four features are scaffolded and connected to Supabase. The build passes cleanly. The database schema has been applied to the live Supabase project. The app has **never been deployed or exercised with real session data**. No tests exist. The ship-schematics storage bucket has not been created.

### Design Imperatives

1. Runnable as a GitHub Pages static site (no server-side rendering, no SSR)
2. Traveller aesthetic: void `#080C14`, amber `#D4A017`, cyan `#1FB8CD`, `Share Tech Mono` font, CRT scan-lines
3. Real-time sync across all players at the table via Supabase realtime
4. TDD: new logic ships with tests; untested legacy logic gets covered before modification

---

## Milestones

| # | Name | Goal | Status |
|---|------|------|--------|
| 0 | Foundation | App live in production, test infra in place | In Progress |
| 1 | Party Roster | Roster is production-ready: import, display, edit, sync | Planned |
| 2 | Inventory Manager | Inventory is production-ready: add/edit, filters, totals, sync | Planned |
| 3 | Ship Schematic Viewer | Ships is production-ready: canonical SVGs, custom upload, annotations, sync | Planned |
| 4 | Trade Ledger | Trade is production-ready: full deal arc, profit calc, sync | Planned |
| 5 | Dice & Reference | Session-critical tools: dice roller + quick rulebook lookups | Planned |
| 6 | Polish & Resilience | Mobile layout, error handling, offline resilience | Planned |
| 7 | Depth | Trade route mapping, cargo generator, character advancement | Planned |

---

## Milestone 0 — Foundation

**Goal:** The app is live on GitHub Pages. A developer can run the test suite. Every future PR goes through CI.

### Tasks

- [ ] Create `ship-schematics` Supabase storage bucket (Public)
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets
- [ ] Commit and push `apps/`, `.github/`, `docs/` to trigger first deploy
- [ ] Verify GitHub Pages deployment serves the app at `/<repo>/`
- [ ] Install Vitest + React Testing Library
- [ ] Write smoke tests: app renders without crashing, `SupabaseProvider` provides context, `SetupScreen` appears when unconfigured
- [ ] Add test script to CI workflow (run on every PR)
- [ ] Verify the CRT aesthetic renders correctly in Chrome and Firefox

### Test targets (Milestone 0)

```
src/lib/supabaseContext — unit: configure(), reset(), getStoredConfig() fallback logic
src/App.tsx             — integration: renders SetupScreen when not configured
src/components/SetupScreen.tsx — unit: form submits url+key to configure()
```

### Milestone 0 Retrospective

*(Fill in after completion)*

Questions to answer:
- Did the deploy work first try? What broke?
- Is the aesthetic consistent across screens? Any Tailwind classes missing or wrong?
- Are the smoke tests catching real regressions, or are they too shallow?
- What surprised us about the existing code?

---

## Milestone 1 — Party Roster

**Goal:** The Party Roster is production-ready: players can import from CSV, add/edit manually, view UPPs and skills clearly, and all clients sync in real time. This is the first feature polished end-to-end.

### Why first

Character data is referenced constantly during play — UPP modifiers, skill levels, careers. It's the feature players need before they sit down, so it must be solid before the first real session.

### Tasks

**Correctness**
- [ ] Create a test CSV with 4 characters covering: full UPPs, skills with varying levels, missing optional columns, quoted fields with internal commas
- [ ] Verify UPP hex display: values ≥10 render as A–F (e.g. 10→A, 15→F)
- [ ] Verify skills parse correctly: `Pilot-2, Navigation-1, Gun Combat (slug)-1`
- [ ] Verify manual add/edit/delete round-trips correctly
- [ ] Two browser tabs: character added in one appears in the other within ~1s
- [ ] Error case: importing a malformed CSV surfaces a useful error, not a crash

**UX improvements**
- [ ] Add a downloadable CSV template so players know the expected column format
- [ ] Show a per-character total skill count in the collapsed card header
- [ ] Skill display: sort alphabetically within the expanded card
- [ ] Manual entry: UPP inputs validate 0–15 only; show the hex equivalent live as you type

**Tests (TDD — write before implementing UX improvements)**
- [ ] `parseCSV()` — happy path, missing optional columns, quoted commas, empty lines
- [ ] `parseSkillsCSV()` — skill names with spaces, level 0, malformed entries
- [ ] `upp()` — boundary values (0, 9, 10, 15)
- [ ] `toHex()` — 0→'0', 9→'9', 10→'A', 15→'F'
- [ ] `CharCard` — renders name, UPP string, skill count; expands on click; shows all skills

### Milestone 1 Retrospective

*(Fill in after completion)*

Questions to answer:
- Is the CSV import format intuitive without the template?
- Did the realtime sync work reliably? Any race conditions on bulk CSV import?
- What did players actually want on a character card that isn't there?
- Are the UPP hex values readable at a glance, or should we add decimal sub-labels?

---

## Milestone 2 — Inventory Manager

**Goal:** The Inventory Manager is production-ready: players can add, edit, and filter party equipment, totals are accurate, and all clients sync in real time.

### Tasks

**Correctness**
- [ ] Enter a full party kit (weapons, armour, tools, medicine); verify mass and value totals
- [ ] Test owner filter, category filter, and both combined
- [ ] Edge cases: items with no weight, no value, quantity zero
- [ ] Two browser tabs: item added in one appears in the other within ~1s
- [ ] Error case: Supabase write failure surfaces visibly, not silently

**UX improvements**
- [ ] Category chips on each row are visually distinct per category (colour-coded or icon)
- [ ] Inline quantity +/− buttons on each row (no need to open the edit form for a count change)
- [ ] Bulk delete: checkbox select + delete selected

**Tests (TDD — write before implementing UX improvements)**
- [ ] Total weight aggregation: null weights excluded, quantity multiplied correctly
- [ ] Total value aggregation: same rules
- [ ] Filter logic: owner filter, category filter, combined filter, no filter
- [ ] `InventoryManager` renders item list; add form submits correctly (mocked Supabase)

### Milestone 2 Retrospective

*(Fill in after completion)*

Questions to answer:
- Did the category filter cover real play needs, or were categories wrong/missing?
- Was inline quantity editing worth the complexity?
- What items did the party track that the schema doesn't handle well?

---

## Milestone 3 — Ship Schematic Viewer

**Goal:** The Ship Viewer is production-ready: canonical SVGs are accurate to the 2022 rulebook, custom image upload works, annotations persist and sync, and the decision on canonical annotations is resolved.

### Tasks

**PDF extraction (do first)**
- [ ] Read deck plan legend (p.189) — reference for icon meanings when auditing SVGs
- [ ] Read Type-S Scout/Courier deck plan (p.191): 2 decks. Deck 2 (main): Bridge (1), Workshop (2), 4 staterooms, probe drone bay, airlock, iris valves, fuel/drives. Deck 1 (upper): Cargo Bay (3). Turret external. Confirm SVG matches this layout.
- [ ] Read Type-A Free Trader deck plan (p.195): 2 decks. Deck 1 (main): Bridge (1), Cargo Bay (2), 20 low berths, drives/fuel. Deck 2 (upper): 10 staterooms + common area. Confirm SVG matches this layout.
- [ ] Note: additional canonical ships exist in the 2022 book — Type-J Seeker (p.193), Type-A2 Far Trader (p.197), Type-K Safari Ship (p.199) — candidates for a third canonical option in M3 UX task

**Correctness**
- [ ] Audit Type-S Scout/Courier SVG against deck plan (p.191): verify room labels, deck count, fuel/drive placement, turret position
- [ ] Audit Type-A Free Trader SVG against deck plan (p.195): verify room labels, low berth count (20), stateroom deck separation
- [ ] Test: upload a custom image, place 3 annotations, verify they persist after page reload
- [ ] Test: remove an annotation; verify removal syncs to a second tab
- [ ] Decide and implement: should canonical ships support annotations? (Recommendation: yes — useful for marking cabin assignments, damage, etc.)
- [ ] Storage bucket: confirm `ship-schematics` bucket is Public and upload/read works end-to-end

**UX improvements**
- [ ] Annotation tooltip: hovering an annotation dot shows the label without cluttering the view; clicking selects it for deletion
- [ ] Ship notes field: freeform text below the schematic for crew manifest, mortgage balance, etc.
- [ ] Add a third canonical ship: Type-K Safari Ship (p.198–199) is the most distinctive option — 200t, unique wide-hull shape, trophy lounge, multi-environment spaces

**Tests (TDD — write before UX improvements)**
- [ ] `handleImageClick()` position calculation: click at known pixel → expected x/y percentage
- [ ] `removeAnnotation()` filters correctly by id
- [ ] `ShipViewer` renders ship list; canonical ship renders its SVG component
- [ ] `canonicalShips` — each entry has required fields (id, name, tonnage, Component)

### Milestone 3 Retrospective

*(Fill in after completion)*

Questions to answer:
- Were the canonical SVGs recognisable and useful, or too abstract?
- Did players actually annotate ships, or was the feature ignored?
- Was the upload flow smooth enough, or did storage errors occur?

---

## Milestone 4 — Trade Ledger

**Goal:** The Trade Ledger is production-ready: players can record a full speculative cargo arc from purchase to sale, profit calculations are correct, and summary cards reflect live state.

### Tasks

**Correctness**
- [ ] Run a full trade arc: buy cargo at world A, mark sold at world B, verify profit/loss
- [ ] Verify summary cards: active capital (cost basis of open deals), realised profit (completed deals only), total deal count
- [ ] Edge cases: fractional prices, zero quantity, cancelled deals excluded from profit, multiple lots of the same cargo
- [ ] Two browser tabs: deal status change in one updates the other within ~1s

**UX improvements**
- [ ] Per-deal profit/loss shown inline in the table row (already implemented — verify it's correct)
- [ ] World filter: filter deals by world bought or world sold
- [ ] Export deals to CSV for session record-keeping
- [ ] "Quick complete" flow: clicking SELL inline is good — verify UX is smooth; add keyboard shortcut (Enter to confirm)

**Tests (TDD — write before UX improvements)**
- [ ] `profit()` — positive, negative, null buy/sell, fractional prices
- [ ] `formatCr()` — zero, large numbers, null
- [ ] Status filter logic: active/completed/cancelled/all
- [ ] Summary card values: active capital excludes completed/cancelled; realised profit sums completed only
- [ ] `TradeLedger` renders deal table; new deal form submits correctly (mocked Supabase)

### Milestone 4 Retrospective

*(Fill in after completion)*

Questions to answer:
- Did the trade workflow match how the group actually plays speculative trade?
- Was the "quick complete" SELL flow fast enough at the table?
- Do players want to track trade routes (which worlds are profitable) across sessions?

---

## Milestone 5 — Dice & Reference

**Goal:** The app is useful *during* a session, not just between sessions. A dice roller and quick-access reference tables remove the need to open the rulebook mid-play.

### Features

**Dice Roller**
- 2D6 core mechanic with modifier input (characteristic bonus or skill level)
- Roll result shows raw dice + modifier + total; highlights success/failure vs difficulty
- Boon (3D6 drop lowest) and Bane (3D6 drop highest) variants
- Roll history for the session (last 20 rolls, not persisted)
- Realtime broadcast: rolls are visible to all players at the table

**Quick Reference Panel**
- Trade goods table (Common, Uncommon, Illegal) from core rulebook — search by name or trade code
- Difficulty ladder (Routine 6+, Average 8+, Difficult 10+, Very Difficult 12+)
- Task chain reminder
- Accessible from any screen via a slide-out drawer or modal

### Tasks

**PDF extraction (do first)**
- [ ] Read Trade Goods table (p.244–245): D66 table with 18 entries (D66 11–36 confirmed on p.244; remainder on p.245). Columns: D66, Type, Availability, Tons, Base Price, Purchase DM, Sale DM, Examples. Transcribe all rows into `src/data/tradeGoods.ts` as a typed array.
- [ ] Note trade goods structure: `{ d66: number, type: string, availability: string, tons: string, basePrice: number, purchaseDM: string, saleDM: string, examples: string }[]`
- [ ] Read Modified Price table (p.243): roll result → purchase % and sale % — useful for a future price calculator feature; record in a comment in `tradeGoods.ts` for now

**Implementation**
- [ ] Scaffold `DiceRoller` component and route
- [ ] Implement roll logic with boon/bane; unit test all edge cases
- [ ] Realtime roll broadcast via Supabase `channel.send()` (ephemeral, no DB write needed)
- [ ] Scaffold `QuickRef` drawer component
- [ ] Transcribe trade goods table from p.244–245 into `src/data/tradeGoods.ts`
- [ ] Write tests: roll distribution, modifier application, boon/bane logic

### Milestone 5 Retrospective

*(Fill in after completion)*

Questions to answer:
- Did players use the dice roller or keep reaching for physical dice?
- Is the broadcast roll feature useful or distracting?
- Was the trade goods table accurate enough? Did we miss categories?

---

## Milestone 6 — Polish & Resilience

**Goal:** The app works on phones and tablets at the table. It degrades gracefully when the Supabase connection is flaky.

### Tasks

**Mobile layout**
- [ ] Audit all four feature screens at 375px viewport
- [ ] Ship Viewer: sidebar collapses to a bottom sheet or top nav on mobile
- [ ] Tables (Trade, Inventory): horizontal scroll or card view on narrow screens
- [ ] Party Roster: already cards — verify at 375px

**Error handling**
- [ ] Supabase errors surface as amber toast notifications, not silent failures
- [ ] Upload failures (storage) show a specific message
- [ ] Realtime reconnection: show a "RECONNECTING..." banner when the WS drops
- [ ] CSV import errors: show which rows failed and why

**Performance**
- [ ] Lazy-load routes so the initial bundle is smaller
- [ ] Verify Lighthouse score ≥ 80 on mobile

### Milestone 6 Retrospective

*(Fill in after completion)*

Questions to answer:
- Were there mobile layout issues we missed in the audit?
- Did any error states actually get triggered in real play? Which ones?
- Is performance acceptable on older phones?

---

## Milestone 7 — Depth

**Goal:** Features that reward long campaigns. Triggered by actual player demand from Milestones 1–3.

*Candidate features — reprioritise based on Milestone 1–6 retrospectives:*

- **Trade route map** — plot world-to-world routes on a subsector grid; colour-code by profit
- **Speculative cargo generator** — roll or auto-generate available cargo lots per the core trade rules
- **Character advancement** — track skill improvements, aging rolls, mustering out benefits across sessions
- **Session log** — timestamped notes per session; searchable
- **Ship mortgage tracker** — monthly payment schedule, running balance, jump fuel costs

---

## Testing Strategy

### Levels

| Level | Tool | What it covers |
|-------|------|----------------|
| Unit | Vitest | Pure functions: `profit()`, `parseCSV()`, `upp()`, `toHex()`, dice logic, filter logic |
| Component | React Testing Library | Renders correctly, form submission, filter interaction |
| Integration | RTL + MSW | Supabase client calls return mocked data; full component data flow |
| E2E (optional) | Playwright | Critical paths: add a trade deal, import a CSV roster |

### Rules

- New logic ships with unit tests before the PR merges.
- Bug fix = reproduction test first, then the fix.
- Supabase calls are mocked at the client level (MSW or vi.mock); no live DB in tests.
- CI runs `npm run lint && npm test` on every PR.

---

## Non-Negotiables

1. **Aesthetic fidelity.** Every new screen must use the established Tailwind classes (`bg-void`, `text-amber`, `text-cyan-trav`, `panel`, `btn-amber`, etc.). No plain white backgrounds, no sans-serif body text.
2. **Anon access.** The app remains usable without authentication. Supabase RLS policies allow anon read/write. If auth is added later, it is additive and optional.
3. **Static deployability.** No server-side code. All data access is client-side Supabase. The `dist/` folder must be deployable to any static host.
4. **Realtime first.** When a player makes a change, all other connected clients see it within ~1 second without a manual refresh.
