-- 20251025120008_diary_auto_entries.sql
-- Robust indexes for diary "daily pages" that tolerate either plant_batch_id or batch_id

-- Ensure entry_date exists (no-op if already present)
alter table public.diary_entries
  add column if not exists entry_date date
  generated always as (date_trunc('day', created_at)::date) stored;

-- Create the composite index using whichever plant reference column exists
do $$
declare
  has_plant_batch_id boolean;
  has_batch_id       boolean;
  plant_col          text;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'diary_entries' and column_name = 'plant_batch_id'
  ) into has_plant_batch_id;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'diary_entries' and column_name = 'batch_id'
  ) into has_batch_id;

  if not has_plant_batch_id and not has_batch_id then
    raise notice 'No plant reference column found on public.diary_entries; skipping plant/date index.';
  else
    plant_col := case when has_plant_batch_id then 'plant_batch_id' else 'batch_id' end;
    execute format(
      'create index if not exists idx_diary_entries_batch_date on public.diary_entries (%I, entry_date)',
      plant_col
    );
  end if;

  -- Also keep a user/date index for fast per-user day views
  execute 'create index if not exists idx_diary_entries_user_date on public.diary_entries (user_id, entry_date)';
end
$$;