-- Auto diary entry on plant stage change
-- Safe for re-runs: drop trigger if it exists, replace function each time.

-- 1) Function: insert a diary row when stage changes.
create or replace function public.diary_on_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_new text;
begin
  -- Only act when stage actually changed (including NULL -> value or value -> NULL)
  if (TG_OP = 'UPDATE') and (coalesce(OLD.stage, '') is distinct from coalesce(NEW.stage, '')) then
    v_old := coalesce(OLD.stage, 'unspecified');
    v_new := coalesce(NEW.stage, 'unspecified');

    -- Insert a concise diary entry
    insert into public.diary_entries (
      plant_batch_id,
      user_id,
      entry_date,
      title,
      content
    )
    values (
      NEW.id,
      NEW.user_id,             -- preserves ownership for RLS
      (now() at time zone 'utc')::date,
      'Stage changed',
      format('Stage changed from "%s" to "%s".', v_old, v_new)
    );
  end if;

  return NEW;
end;
$$;

-- 2) Trigger: attach to plant_batches updates
drop trigger if exists trg_diary_on_stage_change on public.plant_batches;

create trigger trg_diary_on_stage_change
after update on public.plant_batches
for each row
execute function public.diary_on_stage_change();