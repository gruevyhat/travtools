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
  str integer,
  dex integer,
  end_stat integer,
  int_stat integer,
  edu integer,
  soc integer,
  career text,
  rank text,
  homeworld text,
  skills jsonb not null default '[]'::jsonb,
  notes text,
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

-- ============================================================
-- Storage bucket for custom ship schematic images.
-- Create manually in Supabase Dashboard → Storage → New bucket.
-- Bucket name: ship-schematics (Public bucket)
-- ============================================================
