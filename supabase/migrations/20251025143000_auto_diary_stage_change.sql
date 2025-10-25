-- Auto diary entry when a plant's stage changes
-- Uses your schema: diary_entries(batch_id, user_id, note, entry_date)

-- Safe function: no search_path surprises
create or replace function public.fn_log_stage_change()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- Only act when stage actually changes (including NULL <> value)
  if tg_op = 'UPDATE' and (new.stage is distinct from old.stage) then
    insert into public.diary_entries (batch_id, user_id, note, entry_date)
    values (
      new.id,
      new.user_id,
      format('Stage changed: %s → %s',
             coalesce(old.stage, '(none)'),
             coalesce(new.stage, '(none)')
      ),
      current_date
    );
  end if;

  return new;
end;
$$;

-- Recreate the trigger cleanly
drop trigger if exists trg_diary_on_stage_change on public.plant_batches;

create trigger trg_diary_on_stage_change
after update of stage on public.plant_batches
for each row
execute function public.fn_log_stage_change();

-- Helpful composite indexes for your "daily pages" UX (match your columns)
create index if not exists idx_diary_entries_batch_date
  on public.diary_entries (batch_id, entry_date);

create index if not exists idx_diary_entries_user_date
  on public.diary_entries (user_id, entry_date);