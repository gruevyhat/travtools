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

**Goal:** The Party Roster is production-ready for the current campaign: players can import Traveller character XLSX sheets, add/edit manually, view a usable character sheet with expanded attributes and portrait support, roll checks live, apply temporary modifiers, and all clients sync in real time.

### Why first

Character data is referenced constantly during play — UPP modifiers, skill levels, psionic talents. It's the feature players need before they sit down, so it must be solid before the first real session.

### Character sheet analysis findings (docs/characters/)

Four player characters were analyzed from XLSX spreadsheets before implementation:

| Player | Character | UPP | Psionics |
|--------|-----------|-----|---------|
| Eric   | Zlata Gusova | 678CCB | none |
| Graham | (unnamed) | 97B84+ | Awareness-1, Telepathy-0, Teleportation-0 |
| Jesse  | (unnamed) | 468AA9 | Awareness-1, Clairvoyance-2, Telekinesis-0, Telepathy-0 |
| Will   | (unnamed) | 97C996 | none |

Key findings:
- **PSI is a 7th characteristic** (separate from UPP) with its own DM; governs psionic checks
- **5 psionic disciplines**: Awareness, Clairvoyance, Telekinesis, Telepathy, Teleportation — each stored with a level
- **Each skill has a governing characteristic** (e.g. Medic→EDU, Gun Combat→DEX) which must be added to the roll total
- House-rule stats (CHR, MOR, LCK) are inconsistently named across sheets, but should be persisted and shown when present
- Trained skills are level >= 0; untrained is -3 (shown as "--" in spreadsheet) — only show trained in the UI
- XLSX sheets contain useful character-sheet data beyond stats: profile, homeworld, lifepath, armour, augments, equipment, finances, contacts, and background notes
- CSV parsing remains useful for fallback/import tooling, but the player-facing Milestone 1 import target is XLSX

### Data model changes

Schema migration (added to `characters` table):
```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS psi integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS chr integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mor integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS lck integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS portrait_url text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS str_cur integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS dex_cur integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS end_cur integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS psi_cur integer;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS temp_mods jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS psionic_talents jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS profile_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS homeworld_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS lifepath jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS armour jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS augments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS personal_equipment jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS finances jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS background jsonb NOT NULL DEFAULT '{}'::jsonb;
```

New TypeScript types:
```typescript
interface PsionicTalent { name: string; level: number; }
interface AttributeMods { str?: number; dex?: number; end_stat?: number; int_stat?: number; edu?: number; soc?: number; psi?: number; chr?: number; mor?: number; lck?: number; }
// Character gains expanded attributes, current-stat trackers, portrait_url, temp_mods, and XLSX detail sections.
```

### Tasks

**Schema & types**
- [x] Apply Supabase migration: add PSI, expanded attributes, current-stat trackers, portrait URL, temp modifiers, psionic talents, and imported detail sections
- [x] Update `Character` interface and `EMPTY` form default

**Correctness**
- [x] Import representative XLSX character data with full UPPs, skills with varying levels, PSI, psionic talents, and imported sheet sections
- [x] Verify UPP hex display: values >= 10 render as A-F (e.g. 10 -> A, 15 -> F)
- [x] Verify expanded UPP includes PSI/CHR/MOR/LCK when present and omits missing expanded digits
- [x] Verify skills parse correctly from manual entry and XLSX, including specialties such as `Gun Combat (Slug)`
- [x] Verify manual add/edit/delete updates the local roster display immediately
- [x] Verify portrait upload stores and displays a portrait without requiring a Storage bucket
- [x] Verify temporary attribute modifiers change the displayed value and roll DM
- [ ] Two browser tabs: character added in one appears in the other within ~1s
- [ ] Error case: importing a malformed XLSX surfaces a useful error, not a crash

**Character sheet redesign**
- [x] Show characteristic DM for each stat (+/-N format) derived from value
- [x] Show PSI stat and DM in the characteristics grid when PSI exists
- [x] Show expanded attributes CHR, MOR, and LCK when present
- [x] Show only trained skills (level >= 0), sorted alphabetically
- [x] Psionic talents section: show only when character has psionic talents
- [x] Roll button on each characteristic, skill, psionic talent, and weapon
- [x] Render imported profile, homeworld, lifepath, armour, augments, equipment, finances, contacts, and background sections
- [x] Add a right-side portrait column on the desktop character sheet and compact portrait slot on mobile cards
- [x] Move character edit/delete actions behind a gear menu next to the character name

**Dice roller**
- [x] Pre-populate governing characteristic for each skill (hardcoded map: Admin -> EDU, Recon -> INT, etc.)
- [x] Player can change governing characteristic from default in the roll panel
- [x] Difficulty selector: Routine 6+ / Average 8+ / Difficult 10+ / Very Difficult 12+ / Formidable 14+
- [x] Show dice breakdown: `[d1] + [d2] = sum + char DM + skill level + +DM = total`
- [x] Show effect: `SUCCESS/FAILURE · Effect +N`
- [x] Add ad hoc `+DM` input for situational bonuses/penalties
- [x] Persist roll history with character name, label, dice, DMs, total, difficulty, success, and effect

**UX improvements**
- [x] Import XLSX sheets from the roster
- [x] Manual entry: UPP inputs validate 0-15; show the hex equivalent live as you type
- [x] Add PSI, CHR, MOR, LCK fields and PsionicTalents field to manual entry form
- [x] Add collapsible health and PSI trackers
- [x] Add collapsible temporary modifier ribbon
- [x] Add portrait upload from the portrait box
- [x] Keep manual entry inputs usable for multi-character typing across roster, trade, and inventory forms
- [ ] Show a per-character total trained-skill count in the collapsed mobile card header
- [ ] Optional fallback: expose CSV import/template in UI if still desired after XLSX import proves sufficient

**XLSX format (primary import)**
- Profile: name, career, rank, homeworld, profile details, homeworld details, lifepath
- CharacteristicsSkills: STR/DEX/END/INT/EDU/SOC/PSI, CHR/MOR/LCK when present, skills, psionic talents
- CombatEquipment: weapons, armour, augments, personal equipment, finances
- BackgroundPersonality: personality/background text
- Campaign Notes: contacts

**CSV format (parser utility, not current UI requirement)**
```
Name,STR,DEX,END,INT,EDU,SOC,PSI,CHR,MOR,LCK,Career,Rank,Homeworld,PortraitUrl,Skills,PsionicTalents,Notes
```
Skills and PsionicTalents: `SkillName-Level` comma-separated (e.g. `Awareness-1,Telepathy-0`)

**Tests and automated verification**
- [x] `toHex()` — 0 -> '0', 9 -> '9', 10 -> 'A', 15 -> 'F'
- [x] `upp()` — boundary values, expanded attributes, and omission of missing expanded digits
- [x] `statDM()` — verify DM table: 0 -> -3, 1 -> -2, 3 -> -1, 6 -> 0, 9 -> 1, 12 -> 2, 15 -> 3
- [x] `skillChar()` — exact match, parent-skill fallback, unknown -> null
- [x] `parseSkillsCSV()` — skill names with spaces, level 0, malformed entries
- [x] `parseCSV()` — happy path, PSI column, PsionicTalents column, portrait URL aliases, missing optional cols, quoted commas
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run test:e2e`
- [x] `npm run build`
- [x] E2E smoke: configured landing, ships route, roster interactions, form typing, roll log route
- [x] E2E smoke: roster gear menu, expanded UPP, imported detail sections, temp modifier roll DM, portrait upload/render, multi-character form typing, edited character display refresh
- [ ] Manual two-browser realtime sync check

### Milestone 1 Retrospective

*(Fill in after completion)*

Questions to answer:
- Is XLSX import robust enough for all current player sheets, or should CSV import stay exposed as a fallback?
- Did the realtime sync work reliably? Any race conditions on XLSX import, portrait updates, temp modifiers, or edit/delete?
- Does the dice roller feel satisfying at the table? Any UX friction around `+DM` and characteristic overrides?
- Are the temporary modifier, health, and PSI trackers clear enough during live play?
- Is the governing characteristic ever wrong and need manual override?

---

## Milestone 2 — Inventory Manager

**Goal:** The Inventory Manager is production-ready: players can add, edit, and filter party equipment, totals are accurate, and all clients sync in real time.

### Tasks

**Current baseline**
- [x] Add/edit/delete inventory items with name, category, quantity, mass, value, owner, location, and notes
- [x] Owner and category filters are present and can be combined
- [x] Summary cards show visible item count, total mass, and total value
- [x] Inventory writes update the local display optimistically on add/edit/delete
- [x] E2E smoke covers adding an inventory item and verifies multi-character text input

**Correctness**
- [ ] Enter a full party kit (weapons, armour, tools, medicine); verify mass and value totals
- [x] Test owner filter, category filter, and both combined
- [x] Edge cases: items with no weight, no value, quantity zero
- [ ] Two browser tabs: item added in one appears in the other within ~1s
- [x] Error case: Supabase write failure surfaces visibly to the user, not only in `console.error`

**UX improvements**
- [x] Category chips on each row are visually distinct per category (colour-coded or icon)
- [x] Inline quantity +/− buttons on each row (no need to open the edit form for a count change)
- [x] Bulk delete: checkbox select + delete selected

**Tests (TDD — write before implementing UX improvements)**
- [x] Total weight aggregation: null weights excluded, quantity multiplied correctly
- [x] Total value aggregation: same rules
- [x] Filter logic: owner filter, category filter, combined filter, no filter
- [x] `InventoryManager` renders item list; add form submits correctly (mocked Supabase)
- [x] E2E smoke: inventory add item, inline quantity increase, select item, bulk delete

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

**Current baseline**
- [x] Type-S Scout/Courier and Type-A Free Trader canonical SVGs render as selectable ships
- [x] Custom schematic upload uses the public `ship-schematics` Storage bucket
- [x] Custom schematic annotations can be added and removed, and are stored in `ships.annotations`
- [x] E2E smoke covers the Ships route loading without runtime errors
- [x] Character portraits are independent of Storage; only custom ship schematics require the `ship-schematics` bucket

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
- [ ] Storage bucket: confirm `ship-schematics` bucket is Public and custom schematic upload/read works end-to-end

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

**Current baseline**
- [x] Add/edit/delete trade deals with item, quantity, buy/sell prices, worlds, status, and notes
- [x] Status filters exist for all/active/completed/cancelled
- [x] Summary cards show active capital, realised profit, and total deal count
- [x] Per-deal profit/loss is shown inline in the table row
- [x] Active deals have an inline SELL completion flow with Enter/Escape handling
- [x] Trade writes update the local display optimistically on add/edit/delete/complete/cancel
- [x] E2E smoke covers adding a trade deal and verifies multi-character text input

**Correctness**
- [ ] Run a full trade arc: buy cargo at world A, mark sold at world B, verify profit/loss
- [ ] Verify summary cards: active capital (cost basis of open deals), realised profit (completed deals only), total deal count
- [ ] Edge cases: fractional prices, zero quantity, cancelled deals excluded from profit, multiple lots of the same cargo
- [ ] Two browser tabs: deal status change in one updates the other within ~1s

**UX improvements**
- [x] Per-deal profit/loss shown inline in the table row
- [ ] World filter: filter deals by world bought or world sold
- [ ] Export deals to CSV for session record-keeping
- [x] Quick complete flow: clicking SELL inline opens a sell-price input; Enter confirms and Escape cancels

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

**Goal:** The app is useful *during* a session, not just between sessions. The roster-integrated roller and shared roll log are already in place; the remaining work is a standalone always-available dice/reference surface that removes the need to open the rulebook mid-play.

### Features

**Current baseline**
- [x] Characteristic, skill, psionic, weapon, and custom roster checks use 2D6 + characteristic DM + skill/talent level + `+DM`
- [x] Roll result shows raw dice, modifiers, total, success/failure, and effect
- [x] Roll history is persisted in `roll_log` and shown on the Roll Log route
- [x] Roll log updates in realtime via Supabase database inserts

**Standalone Dice Roller**
- [ ] Always-available roll surface outside an individual character sheet
- [ ] 2D6 core mechanic with named modifier input
- [ ] Boon (3D6 drop lowest) and Bane (3D6 drop highest) variants
- [ ] Optional save/broadcast to `roll_log` using a caller-supplied label/name
- [ ] Reuse the roster roll result visual language so players do not learn a second dice UI

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
- [ ] Scaffold standalone `DiceRoller` component or global drawer without duplicating roster roll logic
- [ ] Implement roll logic with boon/bane; unit test all edge cases
- [ ] Decide whether standalone rolls write to persistent `roll_log` or broadcast ephemerally via Supabase `channel.send()`
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
- [ ] Audit current screens at 375px viewport: Ships, Trade, Inventory, Roster, Roll Log, and any Milestone 5 dice/reference surface
- [ ] Ship Viewer: sidebar collapses to a bottom sheet or top nav on mobile
- [ ] Tables (Trade, Inventory): horizontal scroll or card view on narrow screens
- [ ] Party Roster: cards, portrait slot, trackers, and temp modifier ribbon all remain usable at 375px
- [ ] Top navigation remains usable on narrow screens without text overlap

**Error handling**
- [ ] Supabase errors surface as amber toast notifications, not silent failures
- [ ] Ship schematic Storage upload failures show a specific message
- [ ] Character portrait decode/save failures show a specific message
- [ ] Realtime reconnection: show a "RECONNECTING..." banner when the WS drops
- [ ] XLSX import errors show which sheet/section failed when possible
- [ ] Optional CSV fallback errors show which rows failed and why, if CSV UI is restored

**Performance**
- [ ] Lazy-load routes so the initial bundle is smaller
- [ ] Resolve or consciously accept the current Vite chunk-size warning after production builds
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
- **Character advancement** — build on imported lifepath/background data; track skill improvements, aging rolls, mustering out benefits, and long-term wounds/augments across sessions
- **Crew dossier view** — campaign-friendly character dossier that combines portrait, background, contacts, finances, and advancement notes
- **Session log** — timestamped notes per session; searchable
- **Roll analytics** — use persisted `roll_log` data for session recaps, notable failures, and character spotlight moments
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
