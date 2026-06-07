-- ============================================================
-- TRAVTOOLS — Supabase Schema
-- Run this in your Supabase project SQL editor.
-- ============================================================

-- Ships / Schematics
create table if not exists ships (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ship_class text,
  tonnage integer,
  image_url text,
  schematic_type text not null default 'custom'
    check (schematic_type in ('canonical', 'custom')),
  canonical_id text,
  annotations jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- Trade Deals (speculative cargo, trade routes)
create table if not exists trade_deals (
  id uuid default gen_random_uuid() primary key,
  item text not null,
  quantity integer not null default 1,
  buy_price numeric(12, 2),
  sell_price numeric(12, 2),
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  world_bought text,
  world_sold text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory items (party equipment)
create table if not exists inventory_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text,
  quantity integer not null default 1,
  weight_kg numeric(10, 3),
  value_cr numeric(12, 2),
  owner text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Characters (party roster)
create table if not exists characters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  player text,                                          -- player name (distinct from character name)
  str integer,
  dex integer,
  end_stat integer,
  int_stat integer,
  edu integer,
  soc integer,
  psi integer,                                          -- PSI characteristic (null if untested/none)
  chr integer,                                          -- Charisma (house rule extra stat)
  mor integer,                                          -- Morale (house rule extra stat)
  lck integer,                                          -- Luck (house rule extra stat)
  end_cur integer,                                      -- current END (null = full)
  str_cur integer,                                      -- current STR (null = full)
  dex_cur integer,                                      -- current DEX (null = full)
  psi_cur integer,                                      -- current PSI points (null = full)
  career text,
  rank text,
  homeworld text,
  skills jsonb not null default '[]'::jsonb,            -- [{name, level}]
  psionic_talents jsonb not null default '[]'::jsonb,   -- [{name, level}]
  weapons jsonb not null default '[]'::jsonb,           -- [{name, skill, range, damage, traits}]
  notes text,
  created_at timestamptz not null default now()
);

-- Roll Log (shared dice roll history, realtime)
create table if not exists roll_log (
  id uuid default gen_random_uuid() primary key,
  character_name text not null,
  check_label text not null,
  d1 integer not null,
  d2 integer not null,
  char_dm integer not null default 0,
  skill_level integer not null default 0,
  total integer not null,
  difficulty integer not null,
  success boolean not null,
  effect integer not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- For a trusted group (no auth), allow anon read/write.
-- Tighten these policies if you add Supabase Auth later.
-- ============================================================

alter table ships enable row level security;
alter table trade_deals enable row level security;
alter table inventory_items enable row level security;
alter table characters enable row level security;

create policy "anon_all_ships" on ships for all to anon using (true) with check (true);
create policy "anon_all_trade" on trade_deals for all to anon using (true) with check (true);
create policy "anon_all_inventory" on inventory_items for all to anon using (true) with check (true);
create policy "anon_all_characters" on characters for all to anon using (true) with check (true);

alter table roll_log enable row level security;
create policy "anon_all_roll_log" on roll_log for all to anon using (true) with check (true);

-- ============================================================
-- Storage bucket for custom ship schematic images.
-- Create manually in Supabase Dashboard → Storage → New bucket.
-- Bucket name: ship-schematics (Public bucket)
-- ============================================================
