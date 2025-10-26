-- 20251026194500_fix_usage_and_lot_triggers.sql
-- Unify/standardize trigger functions and ensure side-effects:
--  - inventory_item_usages => adjust item qty + write diary entry
--  - inventory_item_lots   => adjust item qty (+ set latest unit_cost)

begin;

-- ---------- USAGE SIDE EFFECTS (qty & diary) ----------

-- Clean slate
drop trigger if exists trg_inv_usage_side_effects on public.inventory_item_usages;
drop function if exists public.fn_inv_usage_side_effects() cascade;

create or replace function public.fn_inv_usage_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid;
  v_item_name text;
  v_unit      text;
  v_delta     numeric;
  v_date      date;
begin
  -- We do NOT rely on NEW.user_id (column doesn't exist on usages).
  -- We derive the owner from the plant batch.
  if TG_OP = 'INSERT' then
    select pb.user_id into v_user_id
    from public.plant_batches pb
    where pb.id = NEW.plant_batch_id;

    select name, unit into v_item_name, v_unit
    from public.inventory_items
    where id = NEW.item_id;

    -- qty down by used amount
    update public.inventory_items
       set qty = coalesce(qty,0) - coalesce(NEW.qty,0)
     where id = NEW.item_id;

    -- diary entry (today or used_at date)
    v_date := coalesce(NEW.used_at::date, current_date);

    insert into public.diary_entries (id, plant_batch_id, user_id, note, entry_date)
    values (
      gen_random_uuid(),
      NEW.plant_batch_id,
      v_user_id,
      format('Applied %s %s of %s', NEW.qty, coalesce(v_unit,'units'), coalesce(v_item_name,'item')),
      v_date
    );

    return NEW;

  elsif TG_OP = 'DELETE' then
    -- reverse the qty on delete
    update public.inventory_items
       set qty = coalesce(qty,0) + coalesce(OLD.qty,0)
     where id = OLD.item_id;

    return OLD;

  elsif TG_OP = 'UPDATE' then
    -- adjust delta if qty changed
    v_delta := coalesce(NEW.qty,0) - coalesce(OLD.qty,0);

    if v_delta <> 0 then
      update public.inventory_items
         set qty = coalesce(qty,0) - v_delta
       where id = NEW.item_id;
    end if;

    return NEW;
  end if;

  return null;
end
$$;

create trigger trg_inv_usage_side_effects
after insert or update or delete
on public.inventory_item_usages
for each row
execute function public.fn_inv_usage_side_effects();

-- ---------- LOTS AFFECT ITEM QTY (and last unit_cost) ----------

drop trigger if exists trg_inv_qty_from_lots on public.inventory_item_lots;
drop function if exists public.fn_inv_qty_from_lots() cascade;

create or replace function public.fn_inv_qty_from_lots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric := 0;
begin
  if TG_OP = 'INSERT' then
    v_delta := coalesce(NEW.qty,0);

    update public.inventory_items
       set qty = coalesce(qty,0) + v_delta,
           unit_cost = coalesce(NEW.unit_cost, unit_cost)
     where id = NEW.item_id;

    return NEW;

  elsif TG_OP = 'DELETE' then
    v_delta := -coalesce(OLD.qty,0);

    update public.inventory_items
       set qty = coalesce(qty,0) + v_delta
     where id = OLD.item_id;

    return OLD;

  elsif TG_OP = 'UPDATE' then
    v_delta := coalesce(NEW.qty,0) - coalesce(OLD.qty,0);

    update public.inventory_items
       set qty = coalesce(qty,0) + v_delta,
           unit_cost = coalesce(NEW.unit_cost, unit_cost)
     where id = coalesce(NEW.item_id, OLD.item_id);

    return NEW;
  end if;

  return null;
end
$$;

create trigger trg_inv_qty_from_lots
after insert or update or delete
on public.inventory_item_lots
for each row
execute function public.fn_inv_qty_from_lots();

commit;