-- 1) Lots: every time you acquire stock for an item
create table if not exists public.inventory_item_lots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  lot_code text,                         -- optional, e.g. PO#, batch #
  qty numeric not null check (qty >= 0), -- quantity received into stock
  unit_cost numeric not null default 0,  -- cost per unit for this lot
  created_at timestamptz not null default now()
);

-- 2) Usages: each time you apply an item to a plant/batch
create table if not exists public.inventory_item_usages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  plant_batch_id uuid references public.plant_batches(id) on delete set null,
  user_id uuid not null default auth.uid(),
  qty numeric not null check (qty > 0),        -- quantity consumed
  note text,
  used_at timestamptz not null default now()
);

-- 3) Adjustments: manual corrections (breakage, recount, etc.)
create table if not exists public.inventory_item_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  delta numeric not null,                        -- + adds stock, - removes stock
  reason text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_item_lots_item on public.inventory_item_lots(item_id);
create index if not exists idx_item_usages_item on public.inventory_item_usages(item_id);
create index if not exists idx_item_usages_batch on public.inventory_item_usages(plant_batch_id);
create index if not exists idx_item_adj_item on public.inventory_item_adjustments(item_id);
alter table public.inventory_item_lots          enable row level security;
alter table public.inventory_item_usages        enable row level security;
alter table public.inventory_item_adjustments   enable row level security;

-- Lots
create policy "lots_select_own" on public.inventory_item_lots
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "lots_insert_own" on public.inventory_item_lots
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Usages
create policy "usg_select_own" on public.inventory_item_usages
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "usg_insert_own" on public.inventory_item_usages
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Adjustments
create policy "adj_select_own" on public.inventory_item_adjustments
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "adj_insert_own" on public.inventory_item_adjustments
  for insert to authenticated
  with check (user_id = (select auth.uid()));
  -- recompute qty = sum(lots) + sum(adjustments.delta) - sum(usages)
create or replace function public.recompute_item_qty(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  select coalesce( (select sum(qty) from inventory_item_lots where item_id=p_item), 0 )
       + coalesce( (select sum(delta) from inventory_item_adjustments where item_id=p_item), 0 )
       - coalesce( (select sum(qty) from inventory_item_usages where item_id=p_item), 0 )
    into v;

  update public.inventory_items set qty = coalesce(v,0) where id = p_item;
end$$;

-- triggers
create or replace function public._after_change_recompute_qty() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_item_qty(coalesce(new.item_id, old.item_id));
  return null;
end$$;

drop trigger if exists trg_recompute_qty_lots on public.inventory_item_lots;
create trigger trg_recompute_qty_lots
after insert or update or delete on public.inventory_item_lots
for each row execute function public._after_change_recompute_qty();

drop trigger if exists trg_recompute_qty_usages on public.inventory_item_usages;
create trigger trg_recompute_qty_usages
after insert or update or delete on public.inventory_item_usages
for each row execute function public._after_change_recompute_qty();

drop trigger if exists trg_recompute_qty_adjs on public.inventory_item_adjustments;
create trigger trg_recompute_qty_adjs
after insert or update or delete on public.inventory_item_adjustments
for each row execute function public._after_change_recompute_qty();