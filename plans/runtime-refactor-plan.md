# Runtime-Focused Refactor Plan

## Summary

Refactor the app on one cleanup branch with runtime speed as the primary goal and reviewability as a secondary constraint. The historical bundle baseline was captured before the current trade and ship additions: initial `index` chunk `1,145.09 kB` minified / `327.45 kB` gzip, `PartyRoster` `439.13 kB` / `140.60 kB`, `TradeLedger` `169.94 kB` / `32.90 kB`, with Vite warnings for chunks over `500 kB`. Treat those numbers as historical only until the current worktree builds again.

Current repo state from `plans/development-plan.md` changes the refactor target:

- Milestone 6 still names `PartyRoster` and the main bundle as optimisation targets, plus a mobile Lighthouse target.
- Milestone 9 Ship Builder hardening is complete enough to split Fleet and Shipyard loading inside the shared `/ships` route.
- Milestone 11 Full Trade Mini-Game is implemented and materially changes the Trade route surface: `DEALS LEDGER`, `TRADE SESSION`, and `PASSENGERS & FREIGHT`.
- Milestone 12 Ammunition Tracking is complete and adds more roster detail work, making roster extraction higher value.
- Milestone 13 NPC generation shipped as a separate `/npc` route with its own data and realtime state.

First restore a reproducible green baseline from the current worktree before doing runtime refactors. `npm run build` currently stops in TypeScript, before Vite emits bundle output, on `m.disabled` in `TradeMiniGame.tsx` method-selector arrays. Fix that blocker or explicitly baseline from a named clean commit. Record the exact commit and dirty-worktree state used for every before/after comparison.

Keep behavior unchanged, preserve Supabase realtime behavior, and treat the modified trade files plus untracked `trojanReachWorlds.ts` as active work. Do not discard or rewrite them except where the trade performance refactor intentionally builds on them.

## Current Constraints

- No user-facing route changes.
- No runtime refactor should introduce a Supabase schema change. Milestone 10 treasury and any trade treasury posting remain separate product work.
- Keep GitHub Pages `/travtools/` base and `HashRouter` unchanged.
- Do not re-enable `CombatTracker`; only lazy-isolate it if it affects build/runtime.
- Keep Traveller reference data local and typed under `src/data/`.
- Preserve the unofficial fan-tool notice on public app surfaces.
- Current `PartyRoster` UI imports/exports CSV only. `parseXLSXCharacter` and `xlsx` are currently used by tests and `scripts/reimport-characters.ts`, not by the roster route. If XLSX UI import/refresh is restored, load the XLSX parser dynamically from that handler.

## Refactor Sequence

### 0. Baseline Gate

- Fix the current TypeScript build blocker in `TradeMiniGame.tsx`:
  - `src/components/trade/TradeMiniGame.tsx:1187`
  - `src/components/trade/TradeMiniGame.tsx:1459`
- Run from `apps/travtools-web/`:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Capture the Vite output, including chunk names and gzip sizes.
- Record:
  - commit hash
  - `git status --short`
  - test count
  - whether the baseline includes dirty trade work

### 1. Split Initial Shell Dependencies

- Lazy-load `GlobalToolsDrawer` from `Shell` only when `TOOLS` opens.
- Add a local `Suspense` boundary in `Shell` so opening tools does not replace the routed page with the app-level fallback.
- Keep the drawer closed path free of:
  - `@dice-roller/rpg-dice-roller`
  - trade goods roller data
  - modified-price table data
- Optionally preload the tools drawer on `TOOLS` hover/focus after the hard lazy boundary is verified.

### 2. Split Trade Tabs Around Milestone 11

- Keep `TradeLedger.tsx` responsible for the deals ledger, tab state, and shared mutation callbacks.
- Move the implemented M11 panels into separately lazy-loaded modules:
  - `TradeSessionPanel` for speculative trade.
  - `PassengersFreightPanel` for passengers, freight, mail, and random passenger hooks.
- Add a local `Suspense` boundary inside `TradeLedger` for tab-panel loading.
- Do not use one shared lazy module if it makes `PASSENGERS & FREIGHT` load the Trojan Reach catalog.
- Split world-profile UI into two layers:
  - a plain `WorldProfileForm` with no `trojanReachWorlds` import, usable by passengers/freight;
  - a catalog-aware trade-session picker that imports `trojanReachWorlds`.
- Move literal default worlds into a small module that exports plain `WorldProfile` objects and does not import the catalog.
- Keep `trojanReachWorlds` absent from:
  - initial landing route
  - Trade deals-only view
  - Passenger/freight tab
- Load `trojanReachWorlds` only through the trade-session path, or only when a catalog picker opens if the session can render without it.
- After behavior is covered, consider deferring the `characters` query/subscription in `TradeLedger` until `TRADE SESSION` or `PASSENGERS & FREIGHT` is selected. Preserve realtime behavior for whichever tabs need roster-backed checks.

### 3. Split Ships Fleet And Shipyard

- `ShipsHub.tsx` currently imports both `ShipViewer` and `ShipBuilder` eagerly. Replace those with tab-level lazy imports and a local `Suspense` fallback.
- Keep Fleet as the default tab and avoid loading Shipyard builder code, ship construction component data, and presets until `SHIPYARD` is selected.
- Keep canonical ship visuals available to Fleet; do not force Fleet users to load Shipyard-only builder controls.
- Preserve the completed M9 behavior:
  - Fleet inline ship specs and schematic annotation.
  - Shipyard save/update/delete.
  - diagram upload.
  - Add to Fleet error handling.

### 4. Roster Refactor And Measurement

- First extract for maintainability in the Milestone 6 order:
  - `RollModal`
  - `CharDetailContent`
  - `CharacterPortrait`
  - `CharacterActionsMenu`
- Move pure loadout helpers into a small library such as `lib/characterLoadout` only when covered by tests:
  - carried mass
  - known skill lookup
  - athletics load bonus
  - encumbrance
  - temp modifier normalization
- Do not assume extraction reduces bundle size. Measure before adding lazy boundaries.
- If XLSX UI import/refresh is restored, dynamically import `parseXLSXCharacter` inside the file handler so `xlsx` is absent from initial app chunks and from the normal roster route.
- Keep current CSV import/export behavior working unless product work deliberately restores the XLSX UI.

### 5. Targeted Render-Cost Work

- Only add `React.memo`, `useMemo`, or callback extraction where profiling or local measurement shows repeated expensive work.
- Candidate derived collections:
  - sorted and grouped roster lists
  - active/deceased roster partitions
  - carried mass and ammo summaries
  - trade deal filters and summaries
  - trade available lots and manifest rows
  - ship damage/ammo/spec summaries
- Keep optimistic Supabase updates local and explicit. If extracting hooks such as `useTradeDeals`, `useCharacters`, or `useShips`, preserve current optimistic rollback and subscription behavior.

### 6. Vite Chunking

- Add `manualChunks` only after real lazy boundaries are in place.
- Candidate stable vendor chunks:
  - `react`
  - `supabase`
  - `xlsx`
  - `dice-roller`
- Do not group unrelated Traveller reference data into one shared chunk if doing so makes `trojanReachWorlds` load with trade goods, passenger/freight data, ship construction data, or another route that does not need it.
- Treat smaller chunk names as secondary. The meaningful metric is bytes loaded by a route or interaction.

## Public Interfaces

- No route changes.
- No Supabase schema changes.
- Internal additions are expected:
  - lazy tools boundary in `Shell`.
  - separate lazy modules for trade session and passenger/freight panels.
  - plain versus catalog-aware trade world-profile components.
  - lazy Fleet/Shipyard boundaries in `ShipsHub`.
  - focused pure helper modules for roster loadout and ship transforms where tests justify extraction.

## Measurement Plan

For each before/after comparison, record:

- total JavaScript bytes loaded by the initial landing route, not just the largest `index` chunk
- route bytes for:
  - landing
  - roster
  - trade deals
  - trade session
  - passenger/freight
  - ships fleet
  - ships shipyard
  - NPCs
  - tools drawer interaction
- which chunks contain:
  - `@dice-roller/rpg-dice-roller`
  - `xlsx`
  - `trojanReachWorlds`
  - ship builder data/components
- whether Vite still reports chunks over `500 kB`, and whether those chunks are loaded by the initial route
- mobile Lighthouse score after the first meaningful split, matching Milestone 6's score target

## Test Plan

- Before and after each major extraction, run:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Run `npm run test:e2e` after route or lazy-boundary changes that affect navigation, tools, roster, trade, or ships.
- Keep or add focused tests for moved pure helpers:
  - roster carried mass, temp modifiers, known skill lookup, ammo summaries, and encumbrance
  - ship spec/damage/ammo normalization and fleet manifest rows
  - ship builder stat block and `designToFleetSpecs`
  - trade world catalog search still finds Drinax and Eglise and supports starport `Y`
- Add interaction coverage for lazy paths:
  - app renders without loading tools UI until `TOOLS` is clicked
  - opening `TOOLS` shows a local tools fallback if needed and does not replace the whole app shell
  - Trade deals tab renders without requiring trade-session UI or world catalog code
  - Passenger/freight tab renders without requiring the Trojan Reach catalog
  - Trade session tab loads its panel and catalog path correctly
  - Ships Fleet tab renders without loading Shipyard-only builder code
  - switching to Shipyard loads the builder and preserves create/save/detail/add-to-fleet behavior
  - roster CSV import/export still works
  - if XLSX UI import/refresh is restored, XLSX import still works after dynamic parser loading

## Acceptance Targets

- The initial landing route no longer triggers Vite's `500 kB` warning for its app-owned static dependency path.
- Any remaining large vendor or reference chunks are intentional and loaded only by routes or interactions that need them.
- `@dice-roller/rpg-dice-roller` is absent from the initial landing route and loads only through the tools drawer.
- `xlsx` is absent from app runtime chunks unless an XLSX UI path is restored; if restored, it loads only through roster XLSX import/refresh.
- `trojanReachWorlds` is absent from the deals-only trade view and passenger/freight tab chunks, and loads only through the trade-session catalog path.
- The default `/ships` Fleet view does not load Shipyard-only builder code or construction data before `SHIPYARD` is selected.
- Existing realtime behavior remains intact for roster, NPCs, ships, ship designs, trade deals, inventory, roll log, and session journal.

## Assumptions

- Use one cleanup branch, but keep commits grouped by subsystem: baseline/build fix, global tools, trade, ships, roster, measurements/tests.
- Prioritize measurable runtime and bundle improvement over cosmetic file moves.
- Treat the current modified trade files and untracked `trojanReachWorlds.ts` as active implementation work.
- Party Treasury integration from Milestone 10 is out of scope for this runtime refactor.
