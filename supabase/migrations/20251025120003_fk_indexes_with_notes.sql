-- 20251025120003_fk_indexes_with_notes.sql
-- Optional “notes” column index; only if column exists

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'plant_batches'
      and column_name  = 'notes'
  ) then
    execute 'create index if not exists idx_pb_notes on public.plant_batches using gin (to_tsvector(''simple'', coalesce(notes, '''')))';
  end if;
end$$;