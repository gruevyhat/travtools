# Travtools Development Plan

## Overview

A group companion app for Traveller RPG (2022 Core Rulebook edition), runnable as a GitHub Pages SPA. Shared real-time state via Supabase. Aesthetic: dark void terminal, amber text, cyan data readouts, CRT scan-lines — the Firefly/Serenity bridge feel.

### Current State

The app is live on GitHub Pages at `https://gruevyhat.github.io/travtools/` and connected to the live Supabase project. The test suite, lint, production build, and GitHub Pages workflow are all active. The current suite has 170 Vitest tests plus a Playwright smoke script covering landing, ships/fleet, shipyard, global tools, roster, form typing, and roll log.

The core app now has a landing dashboard, roster, ships, trade ledger, inventory manager, roll log, and global tools drawer. The four local character XLSX files under `docs/characters/` have been imported into Supabase with the current parser. Character portraits are stored as data URLs; the `ship-schematics` Storage bucket remains relevant only for custom ship schematic uploads.

Travtools is an unofficial fan tool for a private campaign. It is not affiliated with, sponsored by, or endorsed by Mongoose Publishing. Core Rulebook front matter credits include Classic Traveller by Marc Miller, Mongoose Traveller development by Matthew Sprange, and original core mechanics by Gareth Hanrahan. The Core Rulebook copyright notice is: `Traveller ©2026 Mongoose Publishing Ltd. All rights reserved.`

### Design Imperatives

1. Runnable as a GitHub Pages static site (no server-side rendering, no SSR)
2. Traveller aesthetic: void `#080C14`, amber `#D4A017`, cyan `#1FB8CD`, `Share Tech Mono` font, CRT scan-lines
3. Real-time sync across all players at the table via Supabase realtime
4. TDD: new logic ships with tests; untested legacy logic gets covered before modification
5. Every public-facing app surface should preserve the unofficial fan-tool notice and copyright/trademark disclaimer

---

## Milestones

| # | Name | Goal | Status |
|---|------|------|--------|
| 0 | Foundation | App live in production, test infra in place | Complete |
| 1 | Party Roster | Roster is production-ready: import, display, edit, sync | Mostly Complete |
| 2 | Inventory Manager | Inventory is production-ready: add/edit, filters, totals, sync | Mostly Complete |
| 3 | Ship Schematic Viewer | Ships is production-ready: canonical SVGs, custom upload, annotations, sync | Mostly Complete |
| 4 | Trade Ledger | Trade is production-ready: full deal arc, profit calc, sync | Mostly Complete |
| 5 | Dice & Reference | Session-critical tools: dice roller + quick rulebook lookups | Complete |
| 6 | Polish & Resilience | Mobile layout, error handling, offline resilience | In Progress |
| 7 | Depth | Campaign-depth additions: combat, journal, analytics, richer refs | In Progress |
| 8 | Arbitrary Dice Notation Roller | Free-form dice expressions in global tools | Implemented |
| 9 | Ship Builder | Guided spacecraft construction and Fleet integration | In Progress |
| 10 | Party Treasury & Loot Shares | Shared credits ledger and split-loot workflow | Backlog |
| 11 | Full Trade Mini-Game | Complete passenger, freight, and speculative-trade workflow | Backlog |
| 12 | Ammunition Tracking | Persistent weapon ammo and magazine tracking | Backlog |
| 13 | Quick Character Generator | Fast NPC generation from Core Rules quick-character tables | Shipped as NPC route |

---

## Milestone 0 — Foundation

**Goal:** The app is live on GitHub Pages. A developer can run the test suite. Every future PR goes through CI.

### Tasks

- [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets
- [x] Commit and push app source to trigger GitHub Pages deploy
- [x] Verify GitHub Pages deployment serves the app at `/travtools/`
- [x] Install Vitest + React Testing Library
- [x] Write smoke tests: app renders without crashing, `SupabaseProvider` provides context, `SetupScreen` appears when unconfigured
- [x] Add test script to CI workflow
- [x] Verify production build succeeds locally and in CI
- [x] Add landing dashboard as the app index route
- [ ] Verify the CRT aesthetic across Chrome and Firefox after the landing page and module updates

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
| Graham | Rafael Navarro | 9BB8A4 | Awareness-1, Telepathy-0, Teleportation-0 |
| Jesse  | Jesse | 468AB9 | Awareness-1, Clairvoyance-2, Telekinesis-0, Telepathy-0 |
| Will   | Will | 9BC996 | none |

Key findings:
- **PSI is an optional 7th characteristic** (separate from core UPP) with its own DM; show it only when the imported starting PSI value is greater than 0
- **5 psionic disciplines**: Awareness, Clairvoyance, Telekinesis, Telepathy, Teleportation — each stored with a level
- **Each skill has a governing characteristic** (e.g. Medic→EDU, Gun Combat→DEX) which must be added to the roll total
- House-rule stats (CHR, MOR, LCK) are inconsistently named across sheets, but should be persisted and shown when present
- Trained skills are level >= 0; untrained is -3 (shown as "--" in spreadsheet) — only show trained in the UI
- XLSX sheets contain useful character-sheet data beyond stats: profile, homeworld, lifepath, armour, augments, equipment, finances, contacts, and background notes
- BackgroundPersonality sheets contain additional appearance, personality, emotions, favourites, education/training, social class, and relationship/contact fields
- The top-level title defaults to `Traveller`; numeric rank codes stay in lifepath rows and do not become the displayed title
- `Subdermal Armour Protection` is an XLSX artifact from augment protection math and is not imported as armour
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
- [x] Verify default title is `Traveller` when no text title is present
- [x] Verify text titles derived from term notes replace numeric rank codes where possible
- [x] Verify PSI 0/null is omitted from the character sheet and UPP header
- [x] Verify `Subdermal Armour Protection` is not imported as armour
- [ ] Two browser tabs: character added in one appears in the other within ~1s
- [x] Error case: importing a malformed XLSX surfaces a useful error, not a crash

**Character sheet redesign**
- [x] Show characteristic DM for each stat (+/-N format) derived from value
- [x] Show PSI stat and DM in the characteristics grid only when starting PSI is greater than 0
- [x] Show expanded attributes CHR, MOR, and LCK when present
- [x] Show only trained skills (level >= 0), sorted alphabetically
- [x] Psionic talents section: show only when character has psionic talents
- [x] Roll button on each characteristic, skill, psionic talent, and weapon
- [x] Render imported profile, homeworld, lifepath, armour, augments, equipment, finances, contacts, and background sections
- [x] Render character-sheet sections in table order: Profile, Characteristics, Skills/Psionics, Weapons, Armor, Homeworld, Finances, Contacts, then everything else
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
- [x] Refresh an existing character from a new XLSX file through the UI
- [x] Bulk reimport local XLSX files through `scripts/reimport-characters.ts`
- [x] Manual entry: UPP inputs validate 0-15; show the hex equivalent live as you type
- [x] Add PSI, CHR, MOR, LCK fields and PsionicTalents field to manual entry form
- [x] Add collapsible health and PSI trackers
- [x] Add collapsible temporary modifier ribbon
- [x] Add portrait upload from the portrait box
- [x] Keep manual entry inputs usable for multi-character typing across roster, trade, and inventory forms
- [x] Show a per-character total trained-skill count in the collapsed mobile card header
- [ ] Optional fallback: expose CSV import/template in UI if still desired after XLSX import proves sufficient

**XLSX format (primary import)**
- Profile: name, career, rank, homeworld, profile details, homeworld details, lifepath
- CharacteristicsSkills: STR/DEX/END/INT/EDU/SOC/PSI, CHR/MOR/LCK when present, skills, psionic talents
- CombatEquipment: weapons, armour, augments, personal equipment, finances
- BackgroundPersonality: personality/background text
- BackgroundPersonality: appearance, personality, emotions, favourites, training, social role, relationship contacts
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
- [x] `parseXLSXCharacter()` — BackgroundPersonality fields, relationship contacts, text title extraction, default `Traveller` title, ignored Subdermal Armour artifact
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
- [x] Core Rules equipment reference panel is available while the New Inventory Item form is open
- [x] Equipment reference click-to-populate supports armour, augments, comms, weapons, computers, sensors, survival gear, drugs, tools, and related Core Rules items
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
- [x] Equipment reference disappears when the New Inventory Item box is closed

**Tests (TDD — write before implementing UX improvements)**
- [x] Total weight aggregation: null weights excluded, quantity multiplied correctly
- [x] Total value aggregation: same rules
- [x] Filter logic: owner filter, category filter, combined filter, no filter
- [x] `InventoryManager` renders item list; add form submits correctly (mocked Supabase)
- [x] `InventoryManager` reference panel appears only with the item form
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
- [x] Type-K Safari Ship canonical SVG renders as a selectable third ship
- [x] Custom schematic upload uses the public `ship-schematics` Storage bucket
- [x] Custom and canonical schematic annotations can be added and removed, and are stored in `ships.annotations`
- [x] E2E smoke covers ship route interactions: canonical add, annotation add/remove, notes field, and custom upload with mocked Storage
- [x] Character portraits are independent of Storage; only custom ship schematics require the `ship-schematics` bucket

**PDF extraction (do first)**
- [ ] Use `docs/Traveller 2022 Core Rulebook 20-02-2026.pdf` for a page-level ship-plan audit before changing canonical deck plans further
- [ ] Read deck plan legend (p.189) — reference for icon meanings when auditing SVGs
- [ ] Read Type-S Scout/Courier deck plan (p.191): 2 decks. Deck 2 (main): Bridge (1), Workshop (2), 4 staterooms, probe drone bay, airlock, iris valves, fuel/drives. Deck 1 (upper): Cargo Bay (3). Turret external. Confirm SVG matches this layout.
- [ ] Read Type-A Free Trader deck plan (p.195): 2 decks. Deck 1 (main): Bridge (1), Cargo Bay (2), 20 low berths, drives/fuel. Deck 2 (upper): 10 staterooms + common area. Confirm SVG matches this layout.
- [ ] Note: additional canonical ships exist in the 2022 book — Type-J Seeker (p.193), Type-A2 Far Trader (p.197), Type-K Safari Ship (p.199) — candidates for a third canonical option in M3 UX task

**Correctness**
- [x] Implement Type-S Scout/Courier SVG layout from extracted milestone notes: 2 decks, bridge, workshop, 4 staterooms, probe drone bay, airlock, fuel/drives, upper cargo bay, external turret
- [x] Implement Type-A Free Trader SVG layout from extracted milestone notes: 2 decks, bridge, cargo bay, 20 low berths, drives/fuel, 10 staterooms, common area
- [ ] Audit Type-S Scout/Courier SVG against deck plan (p.191): verify room labels, deck count, fuel/drive placement, turret position
- [ ] Audit Type-A Free Trader SVG against deck plan (p.195): verify room labels, low berth count (20), stateroom deck separation
- [ ] Test: upload a custom image, place 3 annotations, verify they persist after page reload
- [ ] Test: remove an annotation; verify removal syncs to a second tab
- [x] Decide and implement: canonical ships support annotations for cabin assignments, damage, and table notes
- [x] Storage bucket: `ship-schematics` bucket created (Public, anon RLS, JPEG/PNG/GIF/WebP/SVG allowed); provisioning added to `supabase/schema.sql`

**UX improvements**
- [x] Annotation tooltip: hovering an annotation dot shows the label without cluttering the view; clicking selects it for deletion
- [x] Ship notes field: freeform text below the schematic for crew manifest, mortgage balance, etc.
- [x] Add a third canonical ship: Type-K Safari Ship (p.198–199) is the most distinctive option — 200t, unique wide-hull shape, trophy lounge, multi-environment spaces
- [x] Storage upload errors surface visibly in the ship viewer, including missing `ship-schematics` bucket failures

**Tests (TDD — write before UX improvements)**
- [x] `handleImageClick()` position calculation: click at known pixel → expected x/y percentage
- [x] `removeAnnotation()` filters correctly by id
- [x] `ShipViewer` renders ship list; canonical ship renders its SVG component
- [x] `canonicalShips` — each entry has required fields (id, name, tonnage, Component)
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run test:e2e`
- [x] `npm run build`

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
- [x] Run a full trade arc: buy cargo at world A, mark sold at world B, verify profit/loss
- [x] Verify summary cards: active capital (cost basis of open deals), realised profit (completed deals only), total deal count
- [x] Edge cases: fractional prices, zero quantity, cancelled deals excluded from profit, multiple lots of the same cargo
- [ ] Two browser tabs: deal status change in one updates the other within ~1s

**UX improvements**
- [x] Per-deal profit/loss shown inline in the table row
- [x] World filter: filter deals by world bought or world sold
- [x] Export deals to CSV for session record-keeping
- [x] Quick complete flow: clicking SELL inline opens a sell-price input; Enter confirms and Escape cancels
- [x] Supabase read/write errors surface visibly in the Trade Ledger

**Tests (TDD — write before UX improvements)**
- [x] `profit()` — positive, negative, null buy/sell, fractional prices
- [x] `formatCr()` — zero, large numbers, null
- [x] Status filter logic: active/completed/cancelled/all
- [x] Summary card values: active capital excludes completed/cancelled; realised profit sums completed only
- [x] `TradeLedger` renders deal table; new deal form submits correctly (mocked Supabase)
- [x] E2E smoke: add active deal, filter by world, sell it, verify profit

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
- [x] Roll log can be cleared from the Roll Log route

**Standalone Dice Roller**
- [x] Always-available roll surface outside an individual character sheet
- [x] 2D6 core mechanic with named modifier input
- [x] Boon (3D6 drop lowest) and Bane (3D6 drop highest) variants
- [x] Optional save to `roll_log` using a caller-supplied label/name
- [x] Reuse the roster roll result visual language so players do not learn a second dice UI

**Quick Reference Panel**
- [x] Trade goods table (Common, Uncommon, Illegal) from core rulebook — search by name or trade code
- [x] Equipment reference data from the Core Rules exposed from Inventory Manager while adding/editing an item
- [x] Difficulty ladder (Routine 6+, Average 8+, Difficult 10+, Very Difficult 12+)
- [x] Task chain reminder
- [x] Accessible from any screen via a slide-out drawer or modal

### Tasks

**PDF extraction**
- [x] Read Trade Goods table (p.244–245): D66 table with 18 entries. Columns: D66, Type, Availability, Tons, Base Price, Purchase DM, Sale DM, Examples. Transcribed into `src/data/tradeGoods.ts` as a typed array.
- [x] Read Core Rules equipment tables and transcribe reference items into `src/data/equipment.ts`
- [ ] Note trade goods structure: `{ d66: number, type: string, availability: string, tons: string, basePrice: number, purchaseDM: string, saleDM: string, examples: string }[]`
- [ ] Read Modified Price table (p.243): roll result → purchase % and sale % — useful for a future price calculator feature; record in a comment in `tradeGoods.ts` for now

**Implementation**
- [x] Scaffold standalone `DiceRoller` component or global drawer without duplicating roster roll logic
- [x] Implement roll logic with boon/bane; unit test all edge cases
- [x] Decide whether standalone rolls write to persistent `roll_log` or broadcast ephemerally via Supabase `channel.send()`
- [x] Scaffold `QuickRef` drawer component
- [x] Transcribe trade goods table from p.244–245 into `src/data/tradeGoods.ts`
- [x] Transcribe Core Rules equipment reference data into `src/data/equipment.ts`
- [x] Write tests: roll distribution, modifier application, boon/bane logic
- [x] Write Roll Log clear action test
- [x] E2E smoke: global tools drawer logs a standalone roll and Roll Log displays it

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
- [ ] Manual audit current screens at 375px viewport: Landing, Ships, Trade, Inventory, Roster, Roll Log, and global tools drawer
- [x] Landing dashboard renders on mobile without text overlap
- [x] Ship Viewer: sidebar collapses above the schematic on mobile
- [x] Tables (Trade, Inventory): horizontal scroll or card view on narrow screens
- [ ] Party Roster: cards, portrait slot, trackers, and temp modifier ribbon all remain usable at 375px
- [x] Top navigation remains usable on narrow screens without text overlap

**Error handling**
- [x] Supabase errors surface as amber inline banners, not silent failures (roster, inventory, trade, tools)
- [x] Ship schematic Storage upload failures show a specific message
- [ ] Character portrait decode/save failures show a specific message
- [x] Browser offline state shows "RECONNECTING..." in the header
- [x] XLSX import errors show which sheet/section failed when possible
- [ ] Optional CSV fallback errors show which rows failed and why, if CSV UI is restored
- [x] Replace native `confirm()` dialog in Roll Log "Clear Log" with a styled in-app confirmation (inconsistent with terminal aesthetic)

**Performance**
- [x] Lazy-load routes so the initial bundle is smaller
- [x] Consciously accept the current Vite chunk-size warning for now; `PartyRoster` and the main bundle remain known optimisation targets
- [ ] Verify Lighthouse score ≥ 80 on mobile

**Code quality**
- [ ] Split `PartyRoster.tsx` (2837 lines) — extract `RollModal`, `CharDetailContent`, `CharacterPortrait`, and `CharacterActionsMenu` into their own files
- [x] Unify `fmtDM()` — removed local definitions from `PartyRoster.tsx` and `RollLog.tsx`; all call sites now import from `dice.ts`
- [x] Fix `InventoryManager.tsx` — removed all redundant `console.error` calls (errors already shown via `setErrorMessage`)

**UX gaps (identified in review)**
- [x] Landing page stats: added Supabase realtime subscriptions — all five stat tables subscribe and re-load on change
- [x] Roll Log: added per-character filter dropdown (shows when 2+ characters have rolled)
- [x] Roll Log: improved `relTime()` — now shows days (2d ago) and formatted dates (May 28) for entries older than 24h / 7d
- [x] Roll Log: added "LOAD MORE" button — fetches in pages of 100 with `hasMore` detection
- [x] Weapon damage rolls logged to Roll Log — `onSaveDamage` callback writes `{weaponName} Damage` entries
- [ ] Background section in character detail: group fields into readable clusters (Personality, History, Goals, etc.) instead of a raw alphabetical dump of all snake_case keys
- [ ] Add a "Roll Initiative for All" party button that shows a ranked initiative list without opening each character card individually

### Milestone 6 Retrospective

*(Fill in after completion)*

Questions to answer:
- Were there mobile layout issues we missed in the audit?
- Did any error states actually get triggered in real play? Which ones?
- Is performance acceptable on older phones?

---

## Milestone 7 — Depth

**Goal:** Features that reward long campaigns and fill the gaps identified in the post-launch review. Reprioritise based on Milestone 1–6 retrospectives and actual table demand.

### High-priority additions (most needed at the table)

- [x] **Flux dice** — `1D6 - 1D6` (range −5 to +5), added as a Flux section in the standalone dice roller.
- [x] **Combat / initiative tracker** — `/combat` route with ranked initiative queue, round counter, per-character minor/significant action tracking, NPC quick-add, reorder, and Supabase broadcast sync.
- [x] **Trade goods roller** — D66 availability roll, tons calculation, and 3D6 Modified Price roller (purchase% and sale%) added to the Global Tools dice tab.
- [x] **Reaction roll and morale** — NPC reaction table (2D6) added to the Reference tab; situational DMs and natural healing also added.

### Medium-priority additions

- [x] **Boon/bane in character roll modal** — Normal / Boon / Bane selector added to `RollModal`; discarded die shown in breakdown.
- **Global Tools Reference tab expansion** — currently only has difficulties, task chain, and boon/bane. Add: common situational DMs, combat action types (minor/significant), natural healing rates, critical hits summary, wound severity table.
- **Jump planner / fuel calculator** — parsec distance input, jump rating, fuel cost in tons. Static calculation; no schema changes needed.
- [x] **Session journal** — `/journal` route with create/edit/delete session notes, auto-save on blur, and Supabase realtime sync.
- **Ship combat tracker** — range bands, ship initiative, damage allocation, repair actions. Complements the existing Ship Viewer. Requires a new schema table or session-local state.

---

## Combat Tracker — Known Issues & Remaining Work

### Resolved: ALLY / ENEMY side selector buttons

**Original symptom:** In the ADD TO COMBAT panel, clicking the ALLY or ENEMY toggle buttons produced no visible change. Clicking ADD subsequently still did nothing (or added the NPC with the wrong side).

**Resolution:**
- Confirmed `type="button"` is present on both buttons, ruling out accidental form submission.
- Confirmed `safe` (`#27AE60`) and `alert` (`#C0392B`) are defined in `tailwind.config.ts`, so the visual-state classes (`border-safe text-safe` / `border-alert text-alert`) should apply.
- Made INIT optional (auto-rolls 1D6 if blank) — this removes one silent failure mode from ADD but does not fix the side buttons.
- Buttons are not inside the draggable combatant rows, so drag-event interference is ruled out.
- No `<form>` wrapper around the ADD TO COMBAT panel, ruling out page reload on submit.
- Fresh Playwright verification showed the selector state changing correctly, so the observed failure was likely stale browser/module state.
- Hardened the UI with `aria-pressed`, selected-state background/ring styling, and targeted component tests.
- Fixed the broadcast path to reuse the subscribed Supabase realtime channel and catch send failures, removing a plausible side-effect source.

### Remaining tasks

- [x] **Fix ALLY/ENEMY side buttons** — verified click behavior, improved selected styling, and added component coverage.
- [x] **Combat interface redesign** — replaced dense micro-control rows with collapsible tactical cards whose collapsed ribbon shows only current-round state: initiative, side, range, target, action readiness, and wound state. Expanded details expose UPP/current stats, combat skills, weapons, side, range, target, and wound controls.
- [x] **Temporary combat module disablement** — live combat tracker is disabled behind `COMBAT_MODULE_DISABLED`; header and landing launch controls show the module as unavailable while preserving the implementation for later re-enable.
- [x] **Clickable combat weapons** — weapon chips roll damage against the selected target, subtract worn PC armor protection, apply net damage through the wound tracker, and show an auditable damage report.
- [x] **Core NPC archetypes** — compact archetype picker adds combat-ready NPCs based on Core Rules quick characters, patrons, encounters, weapons, and armour; archetype skills, weapons, hits, and armour flow into the combat card and weapon-damage path.
- [x] **Active-turn action gating** — only the active combatant can spend actions or trigger weapon damage; inactive cards remain inspectable and editable for targeting/range setup.
- [x] **Target selection UX** — replaced the active-combatant ⊕ flow with a per-card target selector.
- [x] **Drag-and-drop cross-column guard** — invalid cross-side hover now shows a forbidden cursor and alert-highlighted row.
- [x] **NPC hit-point editing after add** — wound panel now has an inline MAX HITS field; NPCs with no hits can start tracking without being re-added.
- [x] **Combat tracker mobile layout** — verified at 375px: no page-level horizontal overflow; add panel, rows, and wound panel remain readable.
- [x] **Realtime sync test** — verified two browser contexts: client B received an NPC add and round advance from client A via Supabase broadcast.

### Long-term candidates

- **Trade route map** — plot world-to-world routes on a subsector grid; colour-code by profit
- **Speculative cargo generator** — roll or auto-generate available cargo lots per the core trade rules; consumes the Modified Price table (p.243, already noted in M5 backlog)
- **Character advancement** — track skill improvements, aging rolls, mustering out benefits, and long-term wounds/augments across sessions
- **Crew dossier view** — campaign-friendly character dossier combining portrait, background, contacts, finances, and advancement notes
- [x] **Roll analytics** — use persisted `roll_log` data for session recaps, notable failures, and character spotlight moments

---

## Milestone 8 — Arbitrary Dice Notation Roller

**Goal:** The standalone dice roller accepts any standard dice notation string (not just 2D6/boon/bane/flux) and evaluates it correctly, showing a full breakdown of individual dice.

### Status: Implemented

The global tools drawer now includes a notation roller powered by `@dice-roller/rpg-dice-roller`, with inline parse errors, optional Roll Log persistence, and a collapsible syntax reference. It is implemented as a section in the existing tools drawer rather than a separate tab.

### Background

The current roller in `GlobalToolsDrawer.tsx` covers the Traveller-specific mechanics (2D6, boon, bane, flux, trade goods rolls). Players occasionally need ad hoc rolls — damage expressions like `3D6+2`, percentile rolls `D100`, skill checks for other systems, or complex expressions like `(2D6+3)*2`. Rather than hard-coding every variant, the `@dice-roller/rpg-dice-roller` npm package (documentation: https://dice-roller.github.io/documentation/guide/notation/) provides a full notation parser and evaluator.

### Supported notation (from the dice-roller library)

| Notation | Meaning |
|----------|---------|
| `XdY` | Roll X dice with Y sides (e.g. `3d6`, `1d20`) |
| `XdY+Z` / `XdY-Z` | Add/subtract a flat modifier |
| `dF` | Fudge/Fate dice (−1, 0, +1) |
| `d%` | Percentile (1–100) |
| `XdYkhN` / `XdYklN` | Keep highest/lowest N dice |
| `XdYdh` / `XdYdl` | Drop highest/lowest |
| `XdY!` | Exploding (reroll and add on max) |
| `XdY!!` | Compounding exploding |
| `XdY!p` | Penetrating exploding |
| `XdYr=N` | Reroll on result N |
| `XdYro=N` | Reroll once on result N |
| `XdYcs>N` | Count successes greater than N |
| `{XdY, ZdW}dl1` | Group roll with keep/drop |
| `(XdY * 2) + 3` | Arithmetic on roll results |

### Tasks

**Implementation**
- [x] Install `@dice-roller/rpg-dice-roller` (MIT licence)
- [x] Add a **NOTATION** section to the standalone dice roller area in `GlobalToolsDrawer.tsx`
- [x] Render a single text input field accepting free-form notation (placeholder: `3d6+2`, `2d20kh1`, `d%`)
- [x] Parse and evaluate with the library; surface parse errors inline (amber warning, no crash)
- [x] Display results using the existing roll-result visual language
- [x] Optional "Save to Roll Log" toggle — if enabled, write the notation string and total to `roll_log`
- [x] Show the dice notation syntax reference in a collapsible HELP panel below the input

**Tests**
- [ ] Unit: `3d6` produces three values in [1,6], total in [3,18]
- [ ] Unit: `2d6+3` total equals sum of two dice plus 3
- [ ] Unit: `2d6kh1` keeps exactly one die (the higher)
- [ ] Unit: `dF` produces values in {-1, 0, 1}
- [ ] Unit: parse error on invalid notation returns an error object, does not throw
- [x] Component: notation input renders, submit calls roll, result panel appears
- [x] Component: invalid notation shows inline error, does not crash

**Non-goals for M8**
The Traveller-specific 2D6 tab and boon/bane/flux mechanics stay exactly as they are. The notation roller is additive only.

---

## Milestone 9 — Ship Builder

**Goal:** Players can design a spacecraft from scratch following the 13-step Core Rules construction process (pp.176–187). The builder tracks tonnage used, running cost, power balance, and produces a shareable ship design saved to Supabase.

### Status: In Progress

**Completed:**
- [x] `ship_designs` Supabase table created with `diagram_url` column and anon RLS policy
- [x] `ship-schematics` Storage bucket is wired for custom schematic and Shipyard diagram uploads; provisioning block is in `supabase/schema.sql`
- [x] `ShipsHub` component routes Fleet (ShipViewer) and Shipyard (ShipBuilder) under a single SHIPS nav tab
- [x] Ship Builder implemented as a 9-step guided wizard (Foundation → Protection → Drives → Power → Bridge → Weapons → Systems → Quarters → Review)
- [x] Four canonical presets in `src/data/shipPresets.ts`: Type S Scout, Type A Free Trader, Type A2 Far Trader, Seeker Mining Ship
- [x] `computeShipSummary()` pure function in `src/lib/shipBuilder.ts` computes all totals, power balance, cargo, warnings
- [x] Running amber stats bar: Hull / Used / Remaining / Power / Cost / Maint; power deficit highlights when negative
- [x] Stepper controls (−/value/+) with hidden browser spinners
- [x] Designs persist to Supabase; new designs switch to detail view on save; edit stays in detail view
- [x] Design detail view: stat block, diagram upload, ADD TO FLEET, EDIT, JSON export, DELETE
- [x] Diagram upload to `ship-schematics` Storage with `contentType: file.type` for correct MIME handling
- [x] Upload errors shown inline in DesignDetail; upload failures no longer silent
- [x] Fleet integration: ADD TO FLEET inserts into `ships` table with computed specs from `designToFleetSpecs()`
- [x] Fleet ship name editing: click ship name → inline input → SAVE/cancel; `selectShip()` resets edit state
- [x] Fleet ship image replacement for custom ships (IMAGE button in header)
- [x] Fleet ship specs panel: view and edit all ship specs fields inline
- [x] CSS `input-base` alias fixed to prevent white browser-default input backgrounds

**Open: Ship Builder Hardening**
- [x] **Completed design detail** (Shipyard): redesign `DesignDetail` to look like a technical schematic document — blueprint-style layout with instrument-panel stat readouts, prominent diagram area, and systems manifest
- [x] **Fleet ship detail** (Fleet): redesign the selected-ship view to be a proper editable record — two-column layout with editable specs on the left and the annotatable schematic on the right; fields always visible and editable without a separate EDIT mode
- [x] E2E smoke covers Shipyard create/save/detail/add-to-fleet flow with mocked `ship_designs`
- [ ] Fix Supabase Storage policy provisioning in `supabase/schema.sql`: `CREATE POLICY IF NOT EXISTS` is not valid Postgres syntax; replace with `DROP POLICY IF EXISTS` + `CREATE POLICY` or a guarded `DO` block
- [ ] Fix over-tonnage handling: `computeShipSummary()` should preserve negative remaining cargo/tonnage or emit a warning instead of clamping cargo to `0`
- [ ] Apply hull `hpMult` when calculating HP, especially for dispersed structure hulls
- [ ] Surface `ADD TO FLEET` insert failures inline instead of always showing `IN FLEET`
- [ ] Decide whether untracked local `data/*.json` and `docs/characters/*.xlsx` campaign files should be committed or ignored

### Background

Spacecraft Construction (p.176) is a 13-step process. Each step consumes hull tonnage and adds to total cost. Two running tallies must always be visible: **Tonnage Remaining** and **Power Balance** (generated minus consumed). The design is illegal if either goes negative.

The builder's Fleet (ShipViewer) and Shipyard (ShipBuilder) now share the `/ships` tab via `ShipsHub`. Completed designs can be added directly to the Fleet from the Shipyard.

### Design Checklist (source: p.177)

Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7 → Step 8 → Step 9 → Step 10 → Step 11 → Step 12 → Step 13

### Data to encode in `src/data/shipComponents.ts`

```typescript
// Hull: Cr50000/ton base; 1 HP per 2.5 tons
// Configs: Standard (partial streamlined), Streamlined (+20% cost), Dispersed (-10% HP, -50% cost)
// Armour: Crystaliron (TL10, 1.25%/point, 5% hull cost/point, max min(TL,13))
//         Bonded Superdense (TL14, 0.80%/point, 8% hull cost/point, max TL)
// M-Drive: 1% hull per thrust, MCr2/ton; TL: 1→TL9, 2-3→TL10, 4-5→TL11, 6-7→TL12, 8-9→TL13
// J-Drive: 2.5% hull per jump + 5t flat, MCr1.5/ton, min 10t; TL: 1→TL9, 2→TL11, 3→TL12, 4→TL13, 5→TL14, 6→TL15
// Power Plant: Fusion TL8 (10 power/ton, MCr0.5/ton), TL12 (15, MCr1), TL15 (20, MCr2)
// Power consumed: basic systems = 20%×hull; M-drive = 10%×hull×thrust; J-drive = 10%×hull×jump
// Fuel (jump) = 10% × hull × jump rating (tons); fuel (PP) = 10% of PP size, min 1t
// Bridge: ≤50t→3t, 51-99→6t, 100-200→10t, 201-1000→20t, 1001-2000→40t, 2001+→60t; MCr0.5/100t
// Cockpit (≤50t only): single 1.5t Cr10000, dual 2.5t Cr15000
// Computer: model 5/10/15/20/25/30/35 at TL7/9/11/12/13/14/15; costs Cr30000/160000/MCr2/5/10/20/30
//   /bis option: +50% cost, +5 processing for Jump Control only
// Sensors: Basic (TL8, DM-4, 0 Power, 0t, free), Civilian (TL9, DM-2, 1 Power, 1t, MCr3),
//   Military (TL10, DM+0, 2 Power, 2t, MCr4.1), Improved (TL12, DM+1, 4 Power, 3t, MCr4.3),
//   Advanced (TL15, DM+2, 6 Power, 5t, MCr5.3)
// Turret mounts: Fixed (0P, 0t, MCr0.1), Single (TL7, 1P, 1t, MCr0.2),
//   Double (TL8, 1P, 1t, MCr0.5), Triple (TL9, 1P, 1t, MCr1)
// Turret weapons: Beam Laser (TL10, Med, 4P, 1D, MCr0.5), Missile Rack (TL7, Spec, 0P, 4D, MCr0.75, Smart),
//   Particle Barbette (TL11, VLong, 15P, 4D, MCr8, Radiation, 5t),
//   Pulse Laser (TL9, Long, 4P, 2D, MCr1), Sandcaster (TL9, Spec, 0P, MCr0.25)
// Staterooms: standard 4t MCr0.5; high 6t MCr0.8; luxury 10t MCr1.5
// Low berths: 0.5t Cr50000 each; 1 Power per 10 berths (round up)
// Common areas: MCr0.1/ton (no HP; recommended ~25% of stateroom tonnage)
// Optional systems (selected): aerofins (5% hull, MCr0.1/ton), cargo crane (2.5t + 0.5t/150t cargo, MCr1/ton),
//   cargo scoop (2t, MCr0.5), collapsible fuel tank (1%/ton empty, Cr500/ton full),
//   concealed compartment (≤5% hull, Cr20000/ton), docking space (docked ship + 10% round up, MCr0.25/ton),
//   mining drones (10t/5 drones, MCr1/10t), probe drones (1t/5, MCr0.5/t),
//   repair drones (1% hull min 1t, MCr0.2/t), fuel processor (MCr0.05/ton, 1P/ton; 20t/ton/day),
//   fuel scoop (MCr1, 0t), laboratory (4t/scientist, ~MCr1/4t),
//   library (TL8, 4t, MCr4), luxury stateroom — see staterooms above,
//   medical bay (4t, MCr2, 1P, 5 patients), multi-environment space (1t equip/20t space, MCr0.5/equip-ton, 1P/equip-ton)
// Crew: Pilot (1; +1 if J-drive), Astrogator (if J-drive), Engineer (1/35t drives+PP),
//   Medic (1/120 crew+pax), Gunner (1/turret), Steward (1/10 high or 1/100 middle pax)
// Maintenance: total cost / 1000 / 12 per month (= annual cost / 12000 per month)
// Construction time: 1 day per MCr1 at average commercial yard
```

### Tasks

Note: the historical 13-step checklist above is retained as source context. The implemented builder consolidates those steps into Foundation, Protection, Drives, Power, Bridge, Weapons, Systems, Quarters, and Review while preserving the running tonnage/power/cost checks.

**Schema**
- [x] Create `ship_designs` Supabase table with `id`, `name`, `design jsonb`, `summary jsonb`, `diagram_url`, `created_at`, and `updated_at`
- [x] Add TypeScript types: `ShipDesignState`, `ShipDesignSummary`, `ShipDesign`, `MountConfig`, and `OptionalSystemEntry`
- [x] Add `specs jsonb` to `ships` for Fleet records created from Shipyard designs
- [x] Add `ship-schematics` bucket provisioning block to `supabase/schema.sql`
- [ ] Correct `ship-schematics` policy SQL so a fresh Supabase SQL-editor run succeeds

**Guided wizard**
- [x] **Foundation**: name, TL, tonnage, hull config, and canonical preset loading
- [x] **Protection**: armour type and protection points with TL warnings
- [x] **Drives**: M-drive and J-drive selectors with TL warnings, tonnage, fuel, and power impact
- [x] **Power**: fusion plant type, power output, PP fuel endurance, generated/used power display
- [x] **Bridge**: bridge/cockpit selection, computer model, `/bis`, sensors, and software
- [x] **Weapons**: hardpoint/firmpoint count, mount entries, weapon slots, power, and cost
- [x] **Systems**: optional systems with quantities, derived tonnage, power, and cost
- [x] **Quarters**: standard/high/luxury staterooms, low berths, common area, and crew implications
- [x] **Review**: summary panel, monthly maintenance, construction time, save/update, diagram upload after save

**Running display (persistent header while building)**
- [x] Amber stats bar at top of builder: used tonnage, cargo, power, cost, HP, hardpoints, and crew
- [x] Red/amber highlight for power deficit
- [ ] Red highlight for over-tonnage designs after negative cargo handling is fixed

**UX**
- [x] Designs list sidebar: load saved designs, create new, edit, delete
- [x] Designs persist to Supabase and refresh through a realtime `ship_designs` subscription
- [x] Export design as JSON
- [x] Add completed design to Fleet with computed technical specs
- [x] Fleet detail supports inline ship name, specs, notes, annotations, and custom image replacement
- [ ] Manual two-browser realtime sync check for Shipyard design save/update/delete
- [ ] Optional: compare to canonical side panel for Type-S / Type-A / Type-A2 / Seeker stats
- [ ] Optional: export design as a human-readable text summary or copy-to-clipboard stat block

**Tests**
- [x] Unit: `computeShipSummary()` — Type-S Scout cargo, fuel, HP, hardpoints, power generated, TL warnings, crew
- [x] Unit: `computeShipSummary()` — Type-A Free Trader cargo and fuel
- [x] Unit: validation warnings for dispersed armour and power deficit
- [x] Unit: no-J-drive design has no astrogator
- [x] E2E smoke: Shipyard create/save/detail/add-to-fleet flow with mocked `ship_designs`
- [ ] Unit: TL gate validation — low-TL M-drive/J-drive/power plant/sensors produce expected warnings
- [ ] Unit: dispersed hull applies `hpMult`
- [ ] Unit: over-tonnage design produces negative remaining cargo or a warning, not silent clamp to zero
- [ ] Component: `ADD TO FLEET` failure surfaces visibly and does not show `IN FLEET`
- [ ] Component: step input changes update the running totals display

---

## Milestone 10 — Party Treasury & Loot Shares

**Goal:** The party can track shared Credits, log all income and expenses, and split loot into equal character shares — replacing ad hoc note-keeping between sessions.

### Background

Traveller characters earn and spend Credits constantly: passenger fares, freight payments, trade profits, fuel, maintenance, bribes, and loot. Currently none of this flows through the app. The Inventory Manager tracks physical items but not money. Character finance sections from XLSX import are read-only. This milestone adds a live shared ledger for party funds.

### Schema

```sql
CREATE TABLE party_treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  amount integer NOT NULL,               -- positive = income, negative = expense
  type text NOT NULL,                    -- 'income' | 'expense' | 'loot' | 'share' | 'trade'
  description text NOT NULL,
  character_id uuid REFERENCES characters(id) ON DELETE SET NULL,  -- null = party-wide
  session_ref text                       -- optional session label
);
```

### Features

**Party Balance header card** (shown at top of the Inventory Manager route and as a landing dashboard stat)
- Running balance = Σ all `amount` values
- Last transaction timestamp

**Transaction log** (tabular, newest first)
- Columns: Date, Type chip (colour-coded), Description, Character, Amount (green/red), Running Balance
- Filter by type and by session ref
- Pagination (100 per page, LOAD MORE)

**Add Transaction form**
- Amount (positive for income, negative for expense, or use separate +/− toggle)
- Type selector: Income / Expense / Loot / Trade Payout
- Description (free text)
- Character attribution (optional — select from roster)
- Session label (free text, defaults to most recent session label used)

**Split Loot action**
- Enter total loot value (Credits)
- Select participating characters (defaults to all active party members)
- Shows per-character share (integer floor, remainder stays in party funds)
- On confirm: creates one `loot` transaction for the total and one `share` credit transaction per character; optionally updates each character's `finances.cash` field
- Supabase realtime broadcasts the split so all players see it immediately

**Integration hooks**
- Trade Ledger: on marking a deal SOLD, show "Add profit to party treasury?" prompt
- Inventory Manager: when bulk-deleting items (assumed sold), show "Add value to party treasury?" prompt
- Passenger/Freight tab (M11): completing a run adds fares automatically

**Tests**
- [ ] Unit: `runningBalance(transactions)` sums amounts correctly including negatives
- [ ] Unit: `splitLoot(total, participantCount)` returns correct per-share and remainder
- [ ] Unit: filter by type and session ref
- [ ] Component: add transaction form submits; balance updates optimistically
- [ ] Component: split loot modal shows correct per-character share; confirms creates correct transaction count
- [ ] E2E smoke: add income, add expense, verify balance; split loot, verify character entries appear

---

## Milestone 11 — Full Trade Mini-Game

**Goal:** The Trade module becomes a complete implementation of the Core Rules trade chapter (pp.238–245): the existing speculative deal ledger is retained as the backbone, and three new tabs expose the full passenger-traffic, freight-lot, and speculative-trade workflows as guided interactive tools with dice rollers built in.

### Background

The Core Rules trade chapter is a standalone mini-game with three income streams:

1. **Passengers** (p.238–239): find them per class (Low/Basic/Middle/High), pay fares by class and parsec distance
2. **Freight** (p.240–241): roll for cargo lot availability (Major/Minor/Incidental), earn flat freight-per-ton rate by parsec; also Mail containers (Cr25000 flat for 5t)
3. **Speculative Trade** (p.241–243): 7-step checklist — find supplier → goods available → purchase price → buy → travel → find buyer → sale price

The Modified Price table and Trade Goods table are already encoded in `src/data/modifiedPrice.ts` and `src/data/tradeGoods.ts`.

**Note on existing `modifiedPrice.ts` values:** the transcribed table uses the roll-indexed version starting at 3. Cross-check against p.243 — the rulebook shows a different range starting at −3 for result, and the existing file maps roll results starting at 3 to purchase/sale %. These need to be reconciled before the mini-game uses them (the purchase% at roll 3 is 40% in the file but 300% in the book; the file appears to have the columns swapped relative to the book scan). Audit and correct before M11 ships.

### New UI structure

Replace the current single-tab `TradeLedger.tsx` with a three-tab layout:

```
[ DEALS LEDGER ] [ TRADE SESSION ] [ PASSENGERS & FREIGHT ]
```

The existing Deals Ledger content moves into tab 1 unchanged.

### Tab 2 — Trade Session (Speculative Trade workflow)

A stateful wizard driven by the 7-step checklist. State is local (one session at a time); completed deals are pushed to the Deals Ledger (tab 1) and optionally to Party Treasury (M10).

**Step 1 — Source World Profile**  
Inputs: World name, Trade Codes (multi-select chips: Agricultural, Asteroid, Desert, Fluid Oceans, Garden, High Pop, High Tech, Ice-Capped, Industrial, Low Pop, Non-Agricultural, Non-Industrial, Poor, Rich, Vacuum, Water World), Starport class (A/B/C/D/E/X), Population code (0–9+), Tech Level, Law Level, Zone (Normal/Amber/Red). Stored in component state and used to derive all DMs below.

**Step 2 — Find Supplier**  
Skill check panel (reuses roster roll visual language):
- Broker check (Average 8+, EDU or SOC, 1D days) — standard supplier
- Streetwise check (Average 8+, EDU or SOC, 1D days) — black market supplier; rolls illegal goods (1D on table, use '6' column)
- Admin check (Average 8+, EDU, 1D hours) — online supplier (TL8+ worlds only)
- Starport DM: A+6, B+4, C+2
- DM-1 per previous supplier attempt this month (counter)
- Result: success → proceed; failure → try again (counter increments)

**Step 3 — Goods Available**  
- Common Goods (D66 11–16) always available on any world
- For each world trade code, show matching Trade Goods rows from `tradeGoods.ts`
- Lot quantity roll: roll the dice expression from the `tons` column (e.g. `2D×10`) with world population modifier (Pop ≤ 3: DM-3 on quantity roll; Pop 9+: DM+3); roll inline with built-in roller
- Black market supplier: also roll 1D on trade goods table using '6' as tens digit (D6 result maps to 61–66 rows); re-roll results 65–66 unless black market
- Display available lots as a table: Good | Available Tons | Base Price | Purchase DM | Sale DM | [ADD TO CART button]
- "Cart" accumulates selected lots and quantities for Step 4

**Step 4 — Purchase Price**  
For each lot in cart:
- Roll 3D (integrated roller, shows breakdown)
- Apply: + Broker skill (input), + Purchase DM(s) for matching trade codes (auto-applied from world profile), − Sale DM(s), − supplier broker skill (default 2, editable)
- Clamp total to table range; look up `modifiedPrice.ts` → purchase%
- Show: base price × purchase% = unit price; unit price × quantity = lot cost
- ACCEPT or REJECT each lot (rejected lots lock out that supplier for 1 month per rules)
- PURCHASE ALL button: creates draft deals in Deals Ledger with status `active`; optionally deducts from Party Treasury

**Step 5 — Travel (informational)**  
Parsec distance input. Displayed as a reminder only — no game mechanic here beyond setting the distance for fare calculation.

**Step 6 — Find Buyer**  
Same as Step 2 but at destination world. Destination World Profile inputs appear (same fields as Step 1). Starport and world DMs for destination apply.

**Step 7 — Sale Price**  
For each active deal in the ledger:
- Roll 3D (integrated roller)
- Apply: + Broker skill, + Sale DM(s) for destination trade codes, − Purchase DM(s), − buyer broker skill (default 2, editable)
- Look up → sale%
- Show: base price × sale% = sale unit price; × quantity = total revenue; profit = revenue − cost
- SELL button: updates deal status to `completed`, records sale price, adds profit to Party Treasury (M10) if linked

### Tab 3 — Passengers & Freight

Two sub-sections, each with a world profile input (reuses/caches the source world state from tab 2) and an integrated roll workflow.

**Passengers sub-section**  
Inputs: Parsec distance, Steward skill on ship (DM+ highest), Chief Steward (DM+ highest), source and destination world population + starport + zone.

Roll workflow (run once per class):
- Roll 2D for each class (Low, Basic, Middle, High)
- Apply class modifier: High passengers DM-4, Low passengers DM+1
- Apply world/starport/zone DMs and each-additional-parsec DM-1 per parsec past 1
- Look up Passenger Traffic table → number of dice to roll for passengers available
- Roll that number of D6 → passengers available
- Fare = Passage & Freight table value for class × parsec distance
- Total income = passengers boarded × fare per passenger

Random Passenger table (D66, p.240) included as a collapsible reference — roll a D66 to generate a passenger's background type.

**Freight sub-section**  
Inputs: Parsec distance, Broker skill (or Streetwise), source and destination world population + starport + TL + zone.

Roll workflow (run once per lot size):
- Roll 2D for each size (Major, Minor, Incidental)
- Apply size modifier: Major DM-4, Incidental DM+2
- Apply world/starport/TL/zone DMs
- Look up Freight Traffic table → number of lots available
- For each lot: roll the appropriate dice (Major: 1D×10t, Minor: 1D×5t, Incidental: 1D×1t)
- Freight income = Σ tons × freight rate per ton from Passage & Freight table
- Mail: roll 2D + mail DMs (freight traffic DM, ship armed +2, TL≤5 −4, naval/scout rank +, SOC DM +); if 12+, 1D mail containers available (5t each, Cr25000 flat, all or none)

**Income summary**: total passenger income + freight income + mail income shown as a transaction ready to add to Party Treasury.

### Data additions needed

- [ ] Passenger Traffic table (2D result → passenger dice) — encode in `src/data/passengerTraffic.ts`
- [ ] Freight Traffic table (2D result → lot dice) — encode in `src/data/freightTraffic.ts`
- [ ] Passage & Freight rate table (parsecs 1–6 × class) — encode in `src/data/passageFares.ts`
- [ ] Random Passenger table (D66 → type) — encode in `src/data/randomPassenger.ts` (reference only)
- [ ] Audit and correct `modifiedPrice.ts` — purchase% and sale% columns appear swapped vs. p.243; add verified comment

### Schema additions

```sql
-- Trade sessions are local/ephemeral; only completed deals persist in the existing deals table.
-- No new tables required beyond Party Treasury (M10) for income logging.
-- Add 'session_ref' column to existing trade deals to group deals from one session.
ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS session_ref text;
ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS base_price integer;
ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS purchase_pct integer;
ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS sale_pct integer;
ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS trade_code text;
```

### Tests

- [ ] Unit: `applyPurchaseDMs(roll, brokerSkill, purchaseDMs, saleDMs, supplierBroker)` applies modifiers correctly and clamps to table range
- [ ] Unit: `lookupModifiedPrice(clampedRoll)` returns correct purchase% and sale%
- [ ] Unit: `calculateLotCost(basePrice, purchasePct, tons)` matches expected credit amounts
- [ ] Unit: `calculateProfit(basePrice, purchasePct, salePct, tons)` is positive when sale% > purchase%
- [ ] Unit: Passenger Traffic table lookup — 2D roll 7 + DMs 0 → 3D passengers for Middle class
- [ ] Unit: Freight Traffic table lookup — 2D roll 8 → correct lot count
- [ ] Unit: `splitPassengerIncome(classes, parsecs)` sums fares correctly
- [ ] Unit: `modifiedPrice.ts` audit — spot-check 5 rows against verified book values
- [ ] Component: Trade Session tab renders; world profile inputs flow into DM display; dice roller shows breakdown
- [ ] Component: Deals Ledger tab unaffected by tab 2 and 3 additions
- [ ] E2E smoke: open Trade, switch to Trade Session tab, enter world profile, roll supplier check, see goods table
- **Ship mortgage tracker** — monthly payment schedule, running balance, jump fuel costs
- **Portrait storage migration** — character portraits are currently stored as JPEG data URLs inside the `characters` table, growing row size significantly; migrating to the existing `ship-schematics` Storage bucket pattern would reduce DB payload

---

## Testing Strategy

### Levels

| Level | Tool | What it covers |
|-------|------|----------------|
| Unit | Vitest | Pure functions: `profit()`, `parseCSV()`, `upp()`, `toHex()`, dice logic, filter logic |
| Component | React Testing Library | Renders correctly, form submission, filter interaction |
| Integration | RTL + MSW | Supabase client calls return mocked data; full component data flow |
| E2E | Playwright | Critical paths: configured landing, ships, roster, trade, inventory, roll log, global tools |

### Rules

- New logic ships with unit tests before the PR merges.
- Bug fix = reproduction test first, then the fix.
- Supabase calls are mocked at the client level (MSW or vi.mock); no live DB in tests.
- CI runs `npm test` and `npm run build` during GitHub Pages deploy; local changes should also run `npm run lint`.

---

## Milestone 12 — Ammunition Tracking

**Goal:** Each character's ranged weapons track their current ammunition count during and between sessions. The combat tracker decrements ammo automatically on weapon use, flags empty weapons, and the party can manage spare magazines through the Inventory Manager.

### Background

Traveller weapons have a **Magazine** capacity (rounds per reload) and **Magazine Cost** (cost of a spare, p.76–77). Reload is a Minor Action. The **Auto** trait (p.79) changes round consumption:

| Fire Mode | Rounds consumed per attack |
|-----------|---------------------------|
| Single | 1 |
| Burst | Auto score (e.g. Auto 3 = 3 rounds) |
| Full Auto | 3 × Auto score (e.g. Auto 3 = 9 rounds) |

Weapons with no Magazine entry (melee, grenades used one at a time, sandcasters) are tracked differently: melee has infinite ammo, grenades and missiles are tracked as consumable inventory items (see Inventory integration below).

Ammo state is per-character, per-weapon, and needs to persist between sessions — the party may end a session mid-combat or with partially loaded magazines. It is stored in Supabase on the `characters` table in a new `ammo_state` jsonb column so all clients see the same counts via realtime.

### Data model

```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS ammo_state jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Shape: { [weaponName: string]: { current: number, magazineSize: number, spareMags: number } }
-- weaponName matches the name field of each weapon in the character's weapons array.
-- spareMags is advisory only (synced from inventory if the item exists there).
```

```typescript
interface WeaponAmmoState {
  current: number;       // rounds remaining in current magazine
  magazineSize: number;  // full magazine capacity (from weapon data)
  spareMags: number;     // spare loaded magazines available
}
type AmmoState = Record<string, WeaponAmmoState>;
```

### Ammo initialisation

When a character is first given an ammo state (or a new weapon is added), `current` is set to `magazineSize` and `spareMags` defaults to 0. The party can edit both values manually at any time. Weapons with no Magazine value in the rulebook (melee, blade, dagger, etc.) are excluded from ammo tracking; the UI omits them silently.

### Integration points

**Party Roster — character detail panel**
- [ ] Add an **AMMO** sub-section to the Weapons block, below each weapon's existing damage chip
- [ ] Each ranged weapon shows: `[current] / [magazineSize] ■■■■□□□ [spare mags: N]`
- [ ] Bar fills amber when ≥ 50% loaded, turns red when ≤ 25% (2 or fewer rounds), goes dark/empty when 0
- [ ] Inline `−` and `+` buttons to manually adjust current count (free-form edits between sessions)
- [ ] **RELOAD** button: sets `current = magazineSize`, decrements `spareMags` by 1 (blocked if `spareMags = 0` and shows a warning; player can override)
- [ ] Clicking RELOAD is a Minor Action reminder — shows a tooltip "Reload costs 1 Minor Action in combat"
- [ ] Edit pencil on spare mag count for freeform entry
- [ ] Changes write to `ammo_state` in Supabase and broadcast via realtime

**Combat Tracker — weapon damage path**
- [ ] When a character fires a weapon in the combat tracker (existing clickable weapon chip), decrement `current` by the correct amount:
  - Default (single): −1
  - If weapon has Auto trait and fire mode is Burst: −Auto score
  - If weapon has Auto trait and fire mode is Full Auto: −(3 × Auto score)
- [ ] Add a **fire mode selector** (Single / Burst / Full Auto) that appears on the weapon chip only if the weapon has the Auto trait; defaults to Single
- [ ] If `current` reaches 0 after firing, the weapon chip turns red and shows `EMPTY — RELOAD`; subsequent clicks are blocked until reloaded
- [ ] **RELOAD** button appears inline on the empty chip; same logic as roster panel (spends a spare mag, warns if none left)
- [ ] Ammo state changes during combat broadcast via Supabase realtime to all connected clients (other players see the ammo bar update live)

**Inventory Manager — spare magazine tracking**
- [ ] Ammo items in the inventory (e.g. "Rifle Magazine ×4", "Autopistol Magazine ×2") can be designated as **ammo** with a new `ammo_for` field linking to a weapon name
- [ ] When an ammo item quantity is edited in the Inventory Manager, the linked character's `spareMags` count updates automatically (quantity of ammo items = spareMags available)
- [ ] Conversely, when RELOAD is pressed in the roster or combat tracker, the linked inventory ammo item decrements by 1 (if the item exists; otherwise only `spareMags` decrements in `ammo_state`)
- [ ] Grenades and missiles are tracked as inventory items with `ammo_for` set to the weapon name; firing them in the combat tracker decrements the inventory quantity by 1

### Fire mode rules summary (shown in UI reference tooltip)

| Mode | Rounds used | DM | Notes |
|------|-------------|-----|-------|
| Single | 1 | normal | |
| Burst | Auto score | +Auto to damage | Cannot aim or use Scope in same action |
| Full Auto | 3 × Auto | Auto attacks | All targets within 6m; cannot aim |

### Tasks

- [ ] Add `ammo_state` column to `characters` table in Supabase
- [ ] Add `ammo_for` field to inventory item schema (nullable text, links weapon name)
- [ ] Update `Character` TypeScript interface with `ammo_state: AmmoState`
- [ ] Update `InventoryItem` TypeScript interface with `ammo_for?: string`
- [ ] Write `initAmmoState(weapons: Weapon[]): AmmoState` — builds initial state from weapon list, skipping melee weapons
- [ ] Write `decrementAmmo(state: AmmoState, weaponName: string, fireMode: 'single' | 'burst' | 'fullAuto', autoScore: number): AmmoState`
- [ ] Write `reloadWeapon(state: AmmoState, weaponName: string): { state: AmmoState; usedMag: boolean }`
- [ ] Ammo sub-section component in character weapon panel (roster)
- [ ] Fire mode selector on Auto-trait weapon chips in combat tracker
- [ ] Auto-decrement on weapon fire in combat tracker
- [ ] Empty-weapon block + inline reload button in combat tracker
- [ ] Realtime broadcast of `ammo_state` changes (reuse existing `characters` realtime subscription)
- [ ] Inventory `ammo_for` field: add to new/edit item form; show linked character name as a read-only badge
- [ ] Inventory ↔ `ammo_state` sync on quantity change (debounced write, 500ms)

### Tests

- [ ] Unit: `initAmmoState()` — melee weapons excluded; rifle starts at `{ current: 20, magazineSize: 20, spareMags: 0 }`
- [ ] Unit: `decrementAmmo()` — single (−1), burst Auto3 (−3), fullAuto Auto3 (−9); clamps to 0, never negative
- [ ] Unit: `decrementAmmo()` — throws/returns error state if `current` is already 0
- [ ] Unit: `reloadWeapon()` — resets `current` to `magazineSize`; decrements `spareMags`; `usedMag: true`
- [ ] Unit: `reloadWeapon()` with `spareMags: 0` — still reloads (manual override allowed), `usedMag: false`
- [ ] Component: ammo bar renders correct fill % and colour thresholds (≥50% amber, ≤25% red, 0 dark)
- [ ] Component: RELOAD button disabled state shows warning text when `spareMags === 0`
- [ ] Component: fire mode selector only renders on Auto-trait weapons
- [ ] Component: weapon chip turns red on empty; click on empty chip does not trigger damage roll
- [ ] E2E smoke: fire a rifle in combat tracker → ammo decrements; RELOAD → ammo resets; second player's roster panel updates within ~1s

---

## Milestone 13 — Quick Character Generator

**Goal:** The GM can instantly generate a plausible NPC using the Quick Characters tables from Core Rulebook pp.91–92, then save the result directly to the party roster.

### Status: Shipped as Standalone NPC Route

The implementation is a dedicated `/npc` module backed by an `npcs` Supabase table rather than a roster modal. It uses `src/data/quickCharacters.ts`, `src/lib/quickCharGen.ts`, generated species/name data, saved NPC records, realtime updates, and NPC roll support. A future pass can add "Save to Roster" if generated NPCs should become full party characters.

### Background

Pages 91–92 of the 2022 Core Rulebook define a three-table rapid NPC generation system:
- **Allies & Enemies** (D66 → 36 archetypes): Naval Officer, Crooked Trader, Mercenary, etc.
- **Character Quirks** (D66 → 36 personality traits): Loyal, In debt to criminals, Spying on the Travellers, etc.
- **Experience Levels** (8 templates): Green/Average/Experienced/Elite × Combatant/Non-combatant — each specifying a skill list, average skill level, and characteristic bonuses (+0 to +1/+2/+3)

Characteristics (STR/DEX/END/INT/EDU/SOC) are generated with 2D6 each, then the experience level's bonuses are applied to the three highest results. The original milestone envisioned saving generated characters directly to the party roster; the shipped version saves them as standalone NPC records with NPC roll support, and roster promotion is deferred.

### Implemented Data Additions

File: `src/data/quickCharacters.ts`

```typescript
export const ALLIES_ENEMIES: { d66: number; archetype: string }[]  // 36 entries, D66 11–66

export const CHARACTER_QUIRKS: { d66: number; quirk: string }[]    // 36 entries, D66 11–66

export interface ExperienceLevel {
  id: string;
  label: string;           // e.g. "Experienced Combatant"
  combatant: boolean;
  skills: { name: string; level: number }[];
  charBonuses: number[];   // e.g. [] | [1] | [1, 2] | [1, 2, 3]
}
export const EXPERIENCE_LEVELS: ExperienceLevel[]  // 8 entries
```

Experience level templates (source: p.92):

| Label | Skills (at avg level) | Avg Level | Char Bonuses |
|-------|-----------------------|-----------|--------------|
| Green Non-combatant | Drive/Flyer | 0 | — |
| Green Combatant | Drive/Flyer, Gun Combat, Melee | 0 | — |
| Average Non-combatant | Drive/Flyer, Profession | 1 | +1 |
| Average Combatant | Drive/Flyer, Gun Combat, Melee, Recon | 1 | +1 |
| Experienced Non-combatant | Admin, Drive/Flyer, Profession | 2 | +1, +2 |
| Experienced Combatant | Drive/Flyer, Gun Combat, Heavy Weapons, Melee, Recon | 2 | +1, +2 |
| Elite Non-combatant | Admin, Drive/Flyer, Investigate, Profession | 3 | +1, +2, +3 |
| Elite Combatant | Drive/Flyer, Gun Combat, Heavy Weapons, Melee, Recon, Tactics | 3 | +1, +2, +3 |

### Implemented Library File: `src/lib/quickCharGen.ts`

Pure functions, unit-testable with an injectable roller:

```typescript
// Extract rollD66() from GlobalToolsDrawer.tsx into dice.ts and re-export
export function generateCharacteristics(roller?): number[]  // returns [str,dex,end,int,edu,soc], each 2D6
export function applyExperienceBonuses(stats: number[], bonuses: number[]): number[]  // adds bonuses to 3 highest
export function generateQuickCharacter(opts?: { roller? }): GeneratedNPC
// Returns: { archetype, quirk, experienceLevel, name, str, dex, end_stat, int_stat, edu, soc, skills, career, notes }
```

### Tasks

**Shipped standalone route**
- [x] Encode quick-character data in `src/data/quickCharacters.ts`
- [x] Extract `rollD66()` into `src/lib/dice.ts` and update Global Tools to import it
- [x] Write `src/lib/quickCharGen.ts` with `generateCharacteristics()`, `applyExperienceBonuses()`, and `generateQuickCharacter()`
- [x] Add `/npc` route with generated NPC display, reroll controls, editable names/notes, saved NPC list, and NPC roll support
- [x] Add `npcs` Supabase table with anon RLS policy
- [x] Saved NPCs persist to Supabase and update through realtime subscriptions

**Deferred roster integration**
- [ ] Decide whether generated NPCs should remain in the standalone `npcs` table or gain a "Save to Roster" promotion flow
- [ ] If promotion is needed, map NPC fields into the full `characters` table shape and preserve archetype/quirk provenance
- [ ] If promotion is needed, add tests for `supabase.from('characters').insert(...)` with the mapped character payload

**Tests**
- [x] Unit: `generateCharacteristics()` — all 6 values in [2, 12]
- [x] Unit: `applyExperienceBonuses()` — bonuses are added to the highest stats, not the lowest
- [x] Unit: `generateQuickCharacter()` — archetype and skills match valid table entries
- [x] Unit: D66 table coverage for quick-character tables
- [x] Quick-character unit coverage included in the current 170-test Vitest suite
- [x] `npm run lint` / `npm test` / `npm run build` pass locally as of repo-state review

### Milestone 13 Retrospective

*(Fill in after completion)*

Questions to answer:
- Did the GM actually use NPC generation at the table, or was it ignored?
- Were the archetype and quirk tables evocative enough, or did they need manual overrides?
- Is the Experience Level a good proxy for combat capability in the tracker?
- Should the modal offer a Career field so the generated NPC shows up correctly in the tracker's archetype picker?

---

## Non-Negotiables

1. **Aesthetic fidelity.** Every new screen must use the established Tailwind classes (`bg-void`, `text-amber`, `text-cyan-trav`, `panel`, `btn-amber`, etc.). No plain white backgrounds, no sans-serif body text.
2. **Anon access.** The app remains usable without authentication. Supabase RLS policies allow anon read/write. If auth is added later, it is additive and optional.
3. **Static deployability.** No server-side code. All data access is client-side Supabase. The `dist/` folder must be deployable to any static host.
4. **Realtime first.** When a player makes a change, all other connected clients see it within ~1 second without a manual refresh.
