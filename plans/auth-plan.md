# Plan: Add authentication (public read, allowlisted-editor writes)

## Context

Today every table in travtools-web is world-writable: RLS policies grant the
`anon` role full read **and** write (`anon_all_*` policies in
`supabase/schema.sql`), and the `ship-schematics` storage bucket allows anon
insert/update/delete. Anyone who loads the public GitHub Pages app — or hits the
Supabase REST endpoint directly with the public anon key — can edit or delete the
whole campaign's data.

Goal: **anyone can view, only an approved group member can change data.** The
security boundary must live in the database (RLS), not just in hidden UI — the
anon key is public, so client-side checks are cosmetic.

Two decisions made with the user:
- **Auth method:** Google sign-in. Because anyone with a Google account can
  authenticate, "logged in" is not enough — write access is gated by an
  **email allowlist enforced in RLS** (`allowed_editors` table).
- **Dice rolls stay open:** appending to `roll_log` (rolling dice) remains
  available to everyone without login. *Clearing* the roll log and every other
  data edit require an allowlisted login.

## Security model summary

| Action | anon (signed out) | authenticated, not on allowlist | authenticated + allowlisted |
|---|---|---|---|
| Read any table | ✅ | ✅ | ✅ |
| Append dice roll (`roll_log` insert) | ✅ | ✅ | ✅ |
| Clear roll log / edit/delete rolls | ❌ | ❌ | ✅ |
| Write all other tables + storage | ❌ | ❌ | ✅ |

The 8 protected tables: `ships`, `trade_deals`, `inventory_items`,
`party_treasury`, `characters`, `session_journal`, `ship_designs`, `npcs`.
Special table: `roll_log`. Plus the `ship-schematics` storage bucket.

---

## 1. Database / RLS (`apps/travtools-web/supabase/schema.sql`)

This is the real boundary; everything else is UX. Edit `schema.sql` (it is the
canonical, re-runnable setup script) and apply it via the Supabase SQL editor /
`mcp__supabase__apply_migration`.

**a. Allowlist table + helper function**

```sql
create table if not exists allowed_editors (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table allowed_editors enable row level security;
-- a signed-in user may read only their own row (used by the client to compute canEdit)
create policy "editor_read_self" on allowed_editors
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- SECURITY DEFINER so write policies can check membership without granting
-- every authenticated user SELECT on the full allowlist (avoids RLS recursion).
create or replace function public.is_allowed_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_editors
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
```

Seed it: `insert into allowed_editors (email) values ('graham.horwood@gmail.com'), (...) on conflict do nothing;`

**b. Protected tables — repeat this pattern for all 8** (shown for `ships`):

```sql
drop policy if exists "anon_all_ships" on ships;
create policy "public_read_ships" on ships
  for select to anon, authenticated using (true);
create policy "editor_write_ships" on ships
  for all to authenticated
  using (public.is_allowed_editor()) with check (public.is_allowed_editor());
```

Permissive policies are OR'd, so: anon reads pass `public_read`; a non-editor
authenticated user reads via `public_read` but every insert/update/delete is
rejected because `editor_write`'s check is false; anon writes are rejected
because no policy grants them. Keeps anon **realtime read subscriptions** working
(they depend on the SELECT policy).

**c. `roll_log` — keep rolls open, protect clearing:**

```sql
drop policy if exists "anon_all_roll_log" on roll_log;
create policy "public_read_roll_log"   on roll_log for select to anon, authenticated using (true);
create policy "public_append_roll_log" on roll_log for insert to anon, authenticated with check (true);
create policy "editor_update_roll_log" on roll_log for update to authenticated using (public.is_allowed_editor()) with check (public.is_allowed_editor());
create policy "editor_delete_roll_log" on roll_log for delete to authenticated using (public.is_allowed_editor());
```

**d. Storage bucket `ship-schematics`** (bottom of `schema.sql`): keep the public
SELECT policy; change the existing Anon insert/update/delete policies to
`to authenticated` with `bucket_id = 'ship-schematics' and public.is_allowed_editor()`.

**Verification of the boundary is non-negotiable** — see the Verification section;
a single un-converted `anon_all_*` policy is a silent hole.

---

## 2. Auth wiring (`apps/travtools-web/src/lib/supabaseContext.tsx`)

Extend the existing context (don't add a second provider). New shape:

```ts
interface SupabaseContextType {
  client; isConfigured; configure; reset;        // unchanged
  session: Session | null;
  user: User | null;
  canEdit: boolean;                              // signed-in AND on allowlist
  authReady: boolean;                            // initial session resolved
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

- On client build / `configure`: call `client.auth.getSession()`, subscribe with
  `client.auth.onAuthStateChange`, and **tear down the subscription when the
  client is rebuilt** (configure/reset) — wire this in a `useEffect` keyed on the
  client instance. supabase-js persists the session in localStorage by default.
- `canEdit`: after a session resolves, call `client.rpc('is_allowed_editor')`
  (security-definer boolean, leaks nothing) and store the result. Recompute on
  every `onAuthStateChange`. Default `false`.
- `signInWithGoogle`: `client.auth.signInWithOAuth({ provider: 'google',
  options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } })`.
  **Gotcha:** the app uses GitHub Pages base `/travtools/` + HashRouter.
  supabase-js (PKCE, `detectSessionInUrl` default) reads the `?code=` it appends
  before the hash on load — works, but the redirect URL must be allow-listed in
  Supabase Auth settings and the Google OAuth app (see docs step below).
- `signOut`: `client.auth.signOut()`.

No `.env` change — the anon/publishable key still builds the client; auth rides
on top.

---

## 3. UI

**a. Login control in `src/components/layout/Shell.tsx`** (header status bar,
next to the ONLINE/Settings cluster):
- signed out → `SIGN IN` button → `signInWithGoogle()`.
- signed in → show user email + `SIGN OUT`.
- a small `READ-ONLY` badge when `!canEdit` (signed out, or signed in but not on
  allowlist) so the mode is legible.

**b. Gate edit controls via `canEdit` — primary entry points only (not all 51
sites in v1).** Consume `canEdit` from context in the 12 mutating components and
hide/disable the top-level create / save / delete / bulk-delete controls when
false. **Leave dice-roll controls always enabled** (GlobalToolsDrawer dice
roller, NpcRollModal, PartyRoster integrated rolls, etc. — these only append to
`roll_log`, which RLS keeps open). Mutating components:
`InventoryManager`, `PartyTreasuryPanel`, `TradeLedger`, `PartyRoster`,
`NPCGenerator`, `SessionJournal`, `ShipBuilder`, `ShipViewer`, `CombatTracker`,
`RollLog` (clear-log button only), `NpcRollModal`/`GlobalToolsDrawer` (roll-log
writes stay open).

**c. Global write-error toast.** RLS is the real gate; anything that slips past
the UI fails server-side. Add a lightweight toast/banner so a rejected write
("new row violates row-level security policy") surfaces legibly instead of
failing silently. A shared helper that wraps the `{ error }` returned by
mutations is enough; full centralization of all 51 call sites is optional and
explicitly **out of scope** for v1.

---

## 4. Tests (`src/__tests__/`)

- `supabaseContext.test.tsx`, `inventory.test.tsx`, `treasury.test.ts` mock
  `useSupabase()` — update the mocks to include the new fields
  (`session`, `user`, `canEdit`, `authReady`, `signInWithGoogle`, `signOut`).
  This is known work, not a surprise.
- Add a context test: default state is signed-out / `canEdit === false`; mocked
  `onAuthStateChange` + `rpc('is_allowed_editor')` flips `canEdit`.
- Add one gating test (e.g. InventoryManager): edit controls hidden when
  `canEdit` is false, shown when true.

## 5. Docs / config (not code, but required for the feature to work)

Update `CLAUDE.md` "Setup" section and add an Auth note:
1. Supabase Dashboard → Authentication → Providers → enable **Google**; create a
   Google Cloud OAuth client, paste client ID/secret.
2. Add Redirect URLs in Supabase Auth: `https://gruevyhat.github.io/travtools/`
   and `http://localhost:5173/travtools/`; mirror these as Authorized redirect
   URIs in the Google OAuth app.
3. Seed `allowed_editors` with each group member's Google email.
4. Re-run `supabase/schema.sql`.

---

## Verification

1. **RLS unit-level (most important):** in the Supabase SQL editor / via
   `mcp__supabase__execute_sql`, confirm with `set role anon;`:
   `select` on each table → succeeds; `insert into ships ...` → **rejected**;
   `insert into roll_log ...` → **succeeds**; `delete from roll_log` →
   **rejected**. Run `mcp__supabase__get_advisors` (security) to catch any table
   left without the new policies / any remaining `anon_all_*`.
2. **App, signed out:** `npm run dev` → all modules render and load data; dice
   roller works and appends to the log; every Add/Save/Delete control is hidden
   or disabled; READ-ONLY badge visible.
3. **App, signed in + allowlisted:** Sign in with Google → edit controls appear,
   a create/edit round-trips and syncs via realtime.
4. **Signed in, NOT allowlisted** (temporarily remove your email): edit controls
   stay hidden; if forced, the write is rejected and the error toast shows.
5. `npm test` (updated suite) and `npm run build` pass.

## Out of scope (v1)
- Centralizing all 51 mutation call sites behind one write wrapper.
- Per-user data ownership / audit columns (all editors are equally trusted).
- Auth on the project-level SetupScreen (that stays separate: it configures
  *which* Supabase project, not *who* the user is).
