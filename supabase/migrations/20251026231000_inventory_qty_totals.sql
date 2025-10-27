-- 20251026231000_inventory_qty_totals.sql
-- Ensure inventory quantities are derived solely from lots and usages.

begin;

-- Remove legacy qty triggers/functions to avoid double adjustments.
drop trigger if exists trg_inv_qty_from_lots on public.inventory_item_lots;
drop function if exists public.fn_inv_qty_from_lots();

drop trigger if exists trg_inv_qty_from_usages on public.inventory_item_usages;
drop function if exists public.fn_inv_qty_from_usages();

drop trigger if exists trg_inventory_usage_qty_and_diary on public.inventory_item_usages;
drop function if exists public.fn_inventory_usage_qty_and_diary();

-- Canonical helper: qty = sum(lots) - sum(usages)
create or replace function public.fn_recalc_item_qty(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in  numeric := 0;
  v_out numeric := 0;
  v_qty numeric := 0;
begin
  select coalesce(sum(qty), 0) into v_in
    from public.inventory_item_lots
   where item_id = p_item_id;

  select coalesce(sum(qty), 0) into v_out
    from public.inventory_item_usages
   where item_id = p_item_id;

  v_qty := coalesce(v_in, 0) - coalesce(v_out, 0);

  update public.inventory_items
     set qty = v_qty
   where id = p_item_id;
end;
$$;

-- Trigger fired for lot changes (insert/update/delete)
create or replace function public.fn_lot_recalc_item_qty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
begin
  v_item := coalesce(new.item_id, old.item_id);
  if v_item is null then
    return coalesce(new, old);
  end if;

  perform public.fn_recalc_item_qty(v_item);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_lot_recalc_qty on public.inventory_item_lots;
create trigger trg_lot_recalc_qty
after insert or update or delete
on public.inventory_item_lots
for each row execute function public.fn_lot_recalc_item_qty();

-- Usage trigger already handles CTP; reassert definition so it also forces qty recalc.
create or replace function public.fn_ctp_usage_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost  numeric;
  v_delta numeric;
begin
  if (tg_op = 'INSERT') then
    v_cost := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if NEW.item_id is not null then
      perform public.fn_recalc_item_qty(NEW.item_id);
    end if;

    return NEW;

  elsif (tg_op = 'DELETE') then
    v_cost := coalesce(fn_item_effective_unit_cost(OLD.item_id), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;

    return OLD;

  elsif (tg_op = 'UPDATE') then
    v_cost := coalesce(fn_item_effective_unit_cost(coalesce(OLD.item_id, NEW.item_id)), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    v_cost := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;
    if NEW.item_id is not null then
      perform public.fn_recalc_item_qty(NEW.item_id);
    end if;

    return NEW;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_ctp_usage_ins_upd_del on public.inventory_item_usages;
create trigger trg_ctp_usage_ins_upd_del
after insert or update or delete
on public.inventory_item_usages
for each row execute function public.fn_ctp_usage_apply();

commit;
