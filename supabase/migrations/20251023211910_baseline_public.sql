-- === VeronaGrow baseline for PUBLIC + STORAGE schemas only ===
-- Safe to apply on a fresh local DB via `supabase db reset`
-- Avoids creating/modifying anything in the `auth` schema.

-- Extensions we rely on
create extension if not exists pgcrypto;

-- =========================
-- PROFILES (user metadata)
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles upsert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

create policy "profiles select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles upsert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- NOTE: We intentionally do NOT create a trigger on auth.users here,
-- to avoid writing into the `auth` schema in local migrations.

-- =========================
-- PLANT BATCHES
-- =========================
create table if not exists public.plant_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  stage text,
  strain text,
  created_at timestamptz default now()
);

alter table public.plant_batches enable row level security;

drop policy if exists "pb sel own" on public.plant_batches;
drop policy if exists "pb ins own" on public.plant_batches;
drop policy if exists "pb upd own" on public.plant_batches;
drop policy if exists "pb del own" on public.plant_batches;

create policy "pb sel own" on public.plant_batches
  for select using (auth.uid() = user_id);

create policy "pb ins own" on public.plant_batches
  for insert with check (auth.uid() = user_id);

create policy "pb upd own" on public.plant_batches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pb del own" on public.plant_batches
  for delete using (auth.uid() = user_id);

create index if not exists idx_pb_user on public.plant_batches(user_id);
create index if not exists idx_pb_start on public.plant_batches(start_date);

-- =========================
-- DIARY ENTRIES
-- =========================
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.plant_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  entry_date date,
  created_at timestamptz default now()
);

alter table public.diary_entries enable row level security;

drop policy if exists "de sel own" on public.diary_entries;
drop policy if exists "de ins own" on public.diary_entries;
drop policy if exists "de del own" on public.diary_entries;

create policy "de sel own" on public.diary_entries
  for select using (auth.uid() = user_id);

create policy "de ins own" on public.diary_entries
  for insert with check (auth.uid() = user_id);

create policy "de del own" on public.diary_entries
  for delete using (auth.uid() = user_id);

create index if not exists idx_de_batch on public.diary_entries(batch_id);
create index if not exists idx_de_user on public.diary_entries(user_id);
create index if not exists idx_de_created on public.diary_entries(created_at);

-- =========================
-- INVENTORY ITEMS
-- =========================
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  unit text not null,                  -- e.g., ml, g, pcs
  unit_cost numeric(12,2) not null default 0,
  qty numeric(12,3) not null default 0,
  created_at timestamptz default now()
);

alter table public.inventory_items enable row level security;

drop policy if exists "inv sel own" on public.inventory_items;
drop policy if exists "inv ins own" on public.inventory_items;
drop policy if exists "inv upd own" on public.inventory_items;
drop policy if exists "inv del own" on public.inventory_items;

create policy "inv sel own" on public.inventory_items
  for select using (auth.uid() = user_id);

create policy "inv ins own" on public.inventory_items
  for insert with check (auth.uid() = user_id);

create policy "inv upd own" on public.inventory_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inv del own" on public.inventory_items
  for delete using (auth.uid() = user_id);

create index if not exists idx_inv_user on public.inventory_items(user_id);
create index if not exists idx_inv_name on public.inventory_items(name);

-- =========================
-- COST ITEMS (per plant)
-- =========================
create table if not exists public.cost_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.plant_batches(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id),
  description text,
  qty numeric(12,3),
  unit text,
  unit_cost numeric(12,2),
  total numeric(12,2),
  created_at timestamptz default now()
);

alter table public.cost_items enable row level security;

drop policy if exists "cost sel own" on public.cost_items;
drop policy if exists "cost ins own" on public.cost_items;
drop policy if exists "cost del own" on public.cost_items;

create policy "cost sel own" on public.cost_items
  for select using (auth.uid() = user_id);

create policy "cost ins own" on public.cost_items
  for insert with check (auth.uid() = user_id);

create policy "cost del own" on public.cost_items
  for delete using (auth.uid() = user_id);

create index if not exists idx_cost_batch on public.cost_items(batch_id);
create index if not exists idx_cost_user on public.cost_items(user_id);
create index if not exists idx_cost_created on public.cost_items(created_at);

-- =========================
-- RPC: apply inventory to a plant (atomic)
-- =========================
create or replace function public.apply_inventory_to_batch(
  p_inventory_item_id uuid,
  p_batch_id uuid,
  p_qty numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_batch record;
  v_total numeric(12,2);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into v_item
    from public.inventory_items
   where id = p_inventory_item_id;

  if v_item is null then
    raise exception 'Inventory item not found';
  end if;
  if v_item.user_id <> v_user then
    raise exception 'Not allowed';
  end if;

  select id, user_id into v_batch
    from public.plant_batches
   where id = p_batch_id;

  if v_batch is null then
    raise exception 'Plant batch not found';
  end if;
  if v_batch.user_id <> v_user then
    raise exception 'Not allowed';
  end if;

  if v_item.qty < p_qty then
    raise exception 'Insufficient stock: available %, requested %', v_item.qty, p_qty;
  end if;

  update public.inventory_items
     set qty = qty - p_qty
   where id = p_inventory_item_id
     and user_id = v_user;

  v_total := round(p_qty * coalesce(v_item.unit_cost, 0), 2);

  insert into public.cost_items (
    user_id, batch_id, inventory_item_id,
    description, qty, unit, unit_cost, total
  ) values (
    v_user, p_batch_id, p_inventory_item_id,
    v_item.name, p_qty, v_item.unit, v_item.unit_cost, v_total
  );
end;
$$;

-- =========================
-- STORAGE (placeholder)
-- =========================
-- (no-op)