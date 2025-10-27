-- 20251026232000_diary_usage_link.sql
-- Link diary entries to inventory usages so deletes stay in sync.

begin;

-- Add the optional foreign key column.
alter table if exists public.diary_entries
  add column if not exists inventory_usage_id uuid;

-- Ensure the FK exists (skip if already present).
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'diary_entries'
      and constraint_name = 'diary_entries_inventory_usage_id_fkey'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_inventory_usage_id_fkey
      foreign key (inventory_usage_id)
      references public.inventory_item_usages(id)
      on delete cascade;
  end if;
end$$;

-- Uniqueness: one diary entry per usage.
create unique index if not exists diary_entries_inventory_usage_id_key
  on public.diary_entries (inventory_usage_id)
  where inventory_usage_id is not null;

-- Trigger: if a diary entry linked to a usage is deleted, remove the usage as well
-- so inventory qty and CTP recalc via existing triggers.
create or replace function public.fn_diary_entries_delete_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.inventory_usage_id is not null then
    delete from public.inventory_item_usages where id = old.inventory_usage_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_diary_delete_usage on public.diary_entries;
create trigger trg_diary_delete_usage
after delete on public.diary_entries
for each row execute function public.fn_diary_entries_delete_usage();

-- Trigger: if a usage is deleted (e.g., from the inventory page), remove the linked diary row.
create or replace function public.fn_usage_delete_diary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.diary_entries where inventory_usage_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_usage_delete_diary on public.inventory_item_usages;
create trigger trg_usage_delete_diary
after delete on public.inventory_item_usages
for each row execute function public.fn_usage_delete_diary();

commit;
