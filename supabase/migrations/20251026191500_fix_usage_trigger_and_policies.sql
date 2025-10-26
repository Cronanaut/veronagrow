-- Fix usage trigger to not depend on NEW.user_id
-- and align RLS policies to infer ownership via inventory_items.user_id

-- 1) Trigger/function (usage → subtract qty + add diary)
drop trigger if exists trg_inventory_usage_qty_and_diary on public.inventory_item_usages;
drop function if exists public.fn_inventory_usage_qty_and_diary();

create or replace function public.fn_inventory_usage_qty_and_diary()
returns trigger
language plpgsql
as $$
declare
  v_item record;
  v_used_at timestamptz;
  v_note text;
begin
  -- find the owning item (for user_id, name, unit)
  select i.id, i.user_id, i.name, i.unit, i.qty
    into v_item
  from public.inventory_items i
  where i.id = NEW.item_id;

  if v_item.id is null then
    raise exception 'Unknown inventory item: %', NEW.item_id;
  end if;

  -- normalize used_at
  if NEW.used_at is null then
    v_used_at := now();
  else
    v_used_at := NEW.used_at::timestamptz;
  end if;

  -- subtract quantity from the item
  update public.inventory_items
     set qty = coalesce(qty, 0) - coalesce(NEW.qty, 0)
   where id = NEW.item_id;

  -- optional diary entry if a plant was provided
  if NEW.plant_batch_id is not null then
    v_note := coalesce(
      NEW.note,
      format(
        'Applied %s %s of %s',
        coalesce(NEW.qty::text,'0'),
        coalesce(v_item.unit,'unit'),
        coalesce(v_item.name,'item')
      )
    );

    insert into public.diary_entries (id, user_id, batch_id, note, entry_date, created_at)
    values (
      gen_random_uuid(),
      v_item.user_id,            -- derive owner from the item
      NEW.plant_batch_id,
      v_note,
      v_used_at::date,
      now()
    );
  end if;

  return NEW;
end;
$$;

create trigger trg_inventory_usage_qty_and_diary
after insert on public.inventory_item_usages
for each row execute function public.fn_inventory_usage_qty_and_diary();

-- 2) RLS policies: infer ownership via inventory_items.user_id
alter table public.inventory_item_usages enable row level security;

drop policy if exists usage_select_own on public.inventory_item_usages;
drop policy if exists usage_insert_own on public.inventory_item_usages;
drop policy if exists usage_update_own on public.inventory_item_usages;
drop policy if exists usage_delete_own on public.inventory_item_usages;

create policy usage_select_own on public.inventory_item_usages
for select using (
  exists (
    select 1 from public.inventory_items i
    where i.id = inventory_item_usages.item_id
      and i.user_id = auth.uid()
  )
);

create policy usage_insert_own on public.inventory_item_usages
for insert with check (
  exists (
    select 1 from public.inventory_items i
    where i.id = inventory_item_usages.item_id
      and i.user_id = auth.uid()
  )
);

create policy usage_update_own on public.inventory_item_usages
for update using (
  exists (
    select 1 from public.inventory_items i
    where i.id = inventory_item_usages.item_id
      and i.user_id = auth.uid()
  )
);

create policy usage_delete_own on public.inventory_item_usages
for delete using (
  exists (
    select 1 from public.inventory_items i
    where i.id = inventory_item_usages.item_id
      and i.user_id = auth.uid()
  )
);