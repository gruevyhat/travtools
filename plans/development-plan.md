# Travtools Development Plan

## Overview

A group companion app for Traveller RPG (2022 Core Rulebook edition), runnable as a GitHub Pages SPA. Shared real-time state via Supabase. Aesthetic: dark void terminal, amber text, cyan data readouts, CRT scan-lines — the Firefly/Serenity bridge feel.

### Current State

The app is live on GitHub Pages at `https://gruevyhat.github.io/travtools/` and connected to the live Supabase project. The test suite, lint, production build, and GitHub Pages workflow are all active. The current suite has 113 Vitest tests plus a Playwright smoke script.

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
| 1 | Party Roster | Roster is production-ready: import, display, edit, sync | In Progress |
| 2 | Inventory Manager | Inventory is production-ready: add/edit, filters, totals, sync | In Progress |
| 3 | Ship Schematic Viewer | Ships is production-ready: canonical SVGs, custom upload, annotations, sync | In Progress |
| 4 | Trade Ledger | Trade is production-ready: full deal arc, profit calc, sync | In Progress |
| 5 | Dice & Reference | Session-critical tools: dice roller + quick rulebook lookups | In Progress |
| 6 | Polish & Resilience | Mobile layout, error handling, offline resilience | In Progress |
| 7 | Depth | Trade route mapping, cargo generator, character advancement | Backlog |

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
- [ ] Storage bucket: confirm `ship-schematics` bucket is Public and custom schematic upload/read works end-to-end

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
- [x] Resolve or consciously accept the current Vite chunk-size warning after production builds
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

## Non-Negotiables

1. **Aesthetic fidelity.** Every new screen must use the established Tailwind classes (`bg-void`, `text-amber`, `text-cyan-trav`, `panel`, `btn-amber`, etc.). No plain white backgrounds, no sans-serif body text.
2. **Anon access.** The app remains usable without authentication. Supabase RLS policies allow anon read/write. If auth is added later, it is additive and optional.
3. **Static deployability.** No server-side code. All data access is client-side Supabase. The `dist/` folder must be deployable to any static host.
4. **Realtime first.** When a player makes a change, all other connected clients see it within ~1 second without a manual refresh.
