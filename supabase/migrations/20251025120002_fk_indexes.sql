-- 20251025120002_fk_indexes.sql
-- Defensive FK/covering indexes: only create if the table/column exists
-- Supports alternative column names (e.g., plant_batch_id vs batch_id)

do $$
declare
  has_env_logs        boolean;
  has_labor_logs      boolean;
  has_plant_batches   boolean;
  has_diary_entries   boolean;
  has_inventory_items boolean;
  has_cost_items      boolean;
begin
  -- table existence flags
  has_env_logs := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='environment_logs' and c.relkind='r'
  );
  has_labor_logs := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='labor_logs' and c.relkind='r'
  );
  has_plant_batches := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='plant_batches' and c.relkind='r'
  );
  has_diary_entries := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='diary_entries' and c.relkind='r'
  );
  has_inventory_items := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='inventory_items' and c.relkind='r'
  );
  has_cost_items := exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='cost_items' and c.relkind='r'
  );

  -- environment_logs (optional)
  if has_env_logs then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='environment_logs' and column_name='batch_id'
    ) then
      execute 'create index if not exists idx_environment_logs_batch_id on public.environment_logs(batch_id)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='environment_logs' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_environment_logs_user_id on public.environment_logs(user_id)';
    end if;
  end if;

  -- labor_logs (optional)
  if has_labor_logs then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='labor_logs' and column_name='batch_id'
    ) then
      execute 'create index if not exists idx_labor_logs_batch_id on public.labor_logs(batch_id)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='labor_logs' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_labor_logs_user_id on public.labor_logs(user_id)';
    end if;
  end if;

  -- plant_batches (present)
  if has_plant_batches then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='plant_batches' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_pb_user on public.plant_batches(user_id)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='plant_batches' and column_name='start_date'
    ) then
      execute 'create index if not exists idx_pb_start on public.plant_batches(start_date)';
    end if;
  end if;

  -- diary_entries (support plant_batch_id OR batch_id)
  if has_diary_entries then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diary_entries' and column_name='plant_batch_id'
    ) then
      execute 'create index if not exists idx_de_batch on public.diary_entries(plant_batch_id)';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diary_entries' and column_name='batch_id'
    ) then
      execute 'create index if not exists idx_de_batch on public.diary_entries(batch_id)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diary_entries' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_de_user on public.diary_entries(user_id)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diary_entries' and column_name='created_at'
    ) then
      execute 'create index if not exists idx_de_created on public.diary_entries(created_at)';
    end if;
  end if;

  -- inventory_items
  if has_inventory_items then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='inventory_items' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_inv_user on public.inventory_items(user_id)';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='inventory_items' and column_name='name'
    ) then
      execute 'create index if not exists idx_inv_name on public.inventory_items(name)';
    end if;
  end if;

  -- cost_items (support plant_batch_id OR batch_id)
  if has_cost_items then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cost_items' and column_name='plant_batch_id'
    ) then
      execute 'create index if not exists idx_cost_batch on public.cost_items(plant_batch_id)';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cost_items' and column_name='batch_id'
    ) then
      execute 'create index if not exists idx_cost_batch on public.cost_items(batch_id)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cost_items' and column_name='user_id'
    ) then
      execute 'create index if not exists idx_cost_user on public.cost_items(user_id)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='cost_items' and column_name='created_at'
    ) then
      execute 'create index if not exists idx_cost_created on public.cost_items(created_at)';
    end if;
  end if;
end
$$;