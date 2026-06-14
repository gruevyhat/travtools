# Runtime-Focused Refactor Plan

## Summary

Refactor the app on one cleanup branch with runtime speed as the primary goal and reviewability as a secondary constraint. The previously captured build baseline was: initial `index` chunk `1,145.09 kB` minified / `327.45 kB` gzip, `PartyRoster` `439.13 kB` / `140.60 kB`, `TradeLedger` `169.94 kB` / `32.90 kB`, with Vite warnings for chunks over `500 kB`.

First restore a reproducible green baseline from the current worktree before doing runtime refactors. `npm run build` must reach Vite output, not stop in TypeScript, so the active trade-session unused-symbol errors need to be resolved or the baseline must be taken from a named clean commit. Record the exact commit/worktree state used for the before/after bundle comparison.

Keep behavior unchanged, preserve Supabase realtime behavior, and avoid touching the existing dirty trade work except where the trade performance refactor intentionally builds on it.

## Key Changes

- Split eager heavy imports:
  - Lazy-load `GlobalToolsDrawer` from `Shell` only when the tools drawer opens, moving `@dice-roller/rpg-dice-roller` out of the initial app path.
    - Add a local `Suspense` boundary in `Shell` so opening tools does not replace the entire route tree with the app-level loading fallback.
  - Dynamically import `parseXLSXCharacter` inside roster XLSX import/refresh handlers so `xlsx` is absent from the `PartyRoster` route chunk and loads only when a sheet is imported.
  - Lazy-load trade mini-game UI from `TradeLedger` only when the relevant tab is opened.
    - Do not use one shared lazy module if it makes `PASSENGERS & FREIGHT` load the Trojan Reach world catalog.
    - Prefer separate lazy modules for `TradeSessionPanel` and `PassengersFreightPanel`, or move the world-catalog import into a session-only component/hook.
    - Add a local `Suspense` boundary inside `TradeLedger` for tab-panel loading.
  - Move `trojanReachWorlds` access behind the trade-session path so the 328-world catalog is not loaded for the plain deals ledger or the passenger/freight tab.
- Add Vite chunking:
  - Configure `manualChunks` for stable vendor chunks: `react`, `supabase`, `xlsx`, `dice-roller`, and large Traveller reference data where useful.
  - Treat `manualChunks` as secondary to real lazy boundaries. A smaller `index` chunk is not sufficient if the same bytes are still static dependencies of the initial route.
  - Do not group unrelated Traveller reference data into a shared chunk when it would make `trojanReachWorlds` load with `tradeGoods` or another deals-route dependency.
  - Keep GitHub Pages `/travtools/` base and `HashRouter` unchanged.
- Reduce rerender cost in large screens:
  - Memoize pure row/card components in roster, trade, and ships where props are stable.
  - Use `useMemo` for expensive derived collections such as sorted/filtered rosters, trade catalog matches, available lots, manifest rows, carried mass, and ship damage/ammo summaries.
  - Keep optimistic Supabase updates but isolate mutation handlers in small hooks so state updates do not force unrelated UI sections to recalculate.
- Extract pure helpers for clarity and testability:
  - Move duplicated roster stat/skill/mass helpers into `lib/traveller` or a small `lib/characterLoadout`.
  - Move ship viewer normalization and manifest helpers into `lib/ships`.
  - Move ship builder formatting/stat-block/fleet-spec transforms into `lib/shipBuilder`.
  - Keep UI components under their current module folders; extraction should not change routes or public UX.

## Public Interfaces

- No user-facing route changes.
- No Supabase schema changes.
- Internal additions:
  - `components/tools/LazyGlobalToolsDrawer` or equivalent lazy boundary.
  - Separate lazy boundaries for trade session and passenger/freight panels, or an equivalent split that keeps the Trojan Reach catalog session-only.
  - Optional module hooks such as `useRealtimeTable`, `useCharacters`, `useTradeDeals`, `useShips`, only if they preserve current optimistic-update behavior.
  - Pure helper exports for roster loadout, ship normalization, and ship builder transforms.

## Test Plan

- Before and after each major extraction, run:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Before the first runtime refactor, make `npm run build` green on the current worktree or explicitly baseline from a named clean commit.
- For every bundle comparison, record:
  - total JavaScript bytes loaded by the initial landing route, not just the largest `index` chunk
  - route chunk sizes for roster, trade deals, trade session, passenger/freight, and tools drawer
  - which chunks contain `xlsx`, `@dice-roller/rpg-dice-roller`, and `trojanReachWorlds`
- Add or update focused tests for moved pure helpers:
  - Roster carried mass, temp modifiers, known skill lookup, and encumbrance.
  - Ship spec/damage/ammo normalization and fleet manifest rows.
  - Ship builder stat block and `designToFleetSpecs`.
  - Trade world catalog search still finds Drinax and Eglise and supports starport `Y`.
- Add interaction tests for lazy paths:
  - App renders without loading tools UI until `TOOLS` is clicked.
  - Opening `TOOLS` shows a local tools fallback if needed and does not replace the whole app shell.
  - Roster still imports and refreshes XLSX after dynamic parser import.
  - Trade deals tab renders without requiring the trade-session world catalog.
  - Passenger/freight tab renders without requiring the trade-session world catalog.
  - Trade session tab loads the catalog only when selected.
- Acceptance target:
  - The initial landing route no longer triggers Vite's `500 kB` warning for its app-owned static dependency path.
  - Any remaining large vendor/reference chunks are intentional and loaded only by routes or interactions that need them.
  - `@dice-roller/rpg-dice-roller` is absent from the initial landing route and loads only through the tools drawer.
  - `xlsx` is absent from the initial app chunk and the `PartyRoster` route chunk, and loads only through roster import/refresh.
  - `trojanReachWorlds` is absent from the deals-only trade view and passenger/freight tab chunks, and loads only through the trade-session path.

## Assumptions

- Use one cleanup branch, as requested, but keep commits grouped by subsystem: build splitting, global tools, roster, trade, ships, tests.
- Prioritize measurable runtime/bundle improvement over purely cosmetic file moves.
- Do not re-enable `CombatTracker`; only exclude or lazy-isolate it if it affects build/runtime.
- Treat current modified trade files and untracked `trojanReachWorlds.ts` as active work and preserve their behavior.
