-- inventory lots & usage: tables, indexes, RLS policies (idempotent-ish)

-- 1) Tables
create table if not exists public.inventory_item_lots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  lot_code text not null,
  qty numeric(12,2) not null default 0,
  unit_cost numeric(12,2),
  received_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_item_usages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  plant_batch_id uuid not null references public.plant_batches(id) on delete cascade,
  qty numeric(12,2) not null,
  note text,
  used_at date,
  created_at timestamptz not null default now()
);

-- 2) Indexes
create index if not exists idx_item_lots_item_created
  on public.inventory_item_lots (item_id, created_at);

create index if not exists idx_item_usages_item_used
  on public.inventory_item_usages (item_id, used_at);

create index if not exists idx_item_usages_batch
  on public.inventory_item_usages (plant_batch_id);

-- 3) RLS
alter table public.inventory_item_lots enable row level security;
alter table public.inventory_item_usages enable row level security;

-- Helper predicates: ownership via inventory_items.user_id and plant_batches.user_id
-- We express policies inline via EXISTS clauses.

-- 3a) inventory_item_lots policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_lots' and policyname='lots_select_own'
  ) then
    create policy lots_select_own on public.inventory_item_lots
      for select using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_lots.item_id
            and i.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_lots' and policyname='lots_insert_own'
  ) then
    create policy lots_insert_own on public.inventory_item_lots
      for insert with check (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_lots.item_id
            and i.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_lots' and policyname='lots_update_own'
  ) then
    create policy lots_update_own on public.inventory_item_lots
      for update using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_lots.item_id
            and i.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_lots.item_id
            and i.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_lots' and policyname='lots_delete_own'
  ) then
    create policy lots_delete_own on public.inventory_item_lots
      for delete using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_lots.item_id
            and i.user_id = auth.uid()
        )
      );
  end if;
end$$;

-- 3b) inventory_item_usages policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_usages' and policyname='usage_select_own'
  ) then
    create policy usage_select_own on public.inventory_item_usages
      for select using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_usages.item_id
            and i.user_id = auth.uid()
        )
        and
        exists (
          select 1 from public.plant_batches pb
          where pb.id = inventory_item_usages.plant_batch_id
            and pb.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_usages' and policyname='usage_insert_own'
  ) then
    create policy usage_insert_own on public.inventory_item_usages
      for insert with check (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_usages.item_id
            and i.user_id = auth.uid()
        )
        and
        exists (
          select 1 from public.plant_batches pb
          where pb.id = inventory_item_usages.plant_batch_id
            and pb.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_usages' and policyname='usage_update_own'
  ) then
    create policy usage_update_own on public.inventory_item_usages
      for update using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_usages.item_id
            and i.user_id = auth.uid()
        )
        and
        exists (
          select 1 from public.plant_batches pb
          where pb.id = inventory_item_usages.plant_batch_id
            and pb.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_usages.item_id
            and i.user_id = auth.uid()
        )
        and
        exists (
          select 1 from public.plant_batches pb
          where pb.id = inventory_item_usages.plant_batch_id
            and pb.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inventory_item_usages' and policyname='usage_delete_own'
  ) then
    create policy usage_delete_own on public.inventory_item_usages
      for delete using (
        exists (
          select 1 from public.inventory_items i
          where i.id = inventory_item_usages.item_id
            and i.user_id = auth.uid()
        )
        and
        exists (
          select 1 from public.plant_batches pb
          where pb.id = inventory_item_usages.plant_batch_id
            and pb.user_id = auth.uid()
        )
      );
  end if;
end$$;