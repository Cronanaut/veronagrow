-- 20251025120006_add_userid_indexes.sql
-- Create/ensure indexes on user_id for present tables only.
-- (Removed labor_logs to avoid errors when that table is absent.)

do $$
begin
  -- plant_batches
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'plant_batches' and c.relkind = 'r'
  ) then
    execute 'create index if not exists idx_pb_user on public.plant_batches(user_id)';
  end if;

  -- diary_entries
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'diary_entries' and c.relkind = 'r'
  ) then
    execute 'create index if not exists idx_de_user on public.diary_entries(user_id)';
  end if;

  -- inventory_items
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'inventory_items' and c.relkind = 'r'
  ) then
    execute 'create index if not exists idx_inv_user on public.inventory_items(user_id)';
  end if;

  -- cost_items
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'cost_items' and c.relkind = 'r'
  ) then
    execute 'create index if not exists idx_cost_user on public.cost_items(user_id)';
  end if;
end$$;