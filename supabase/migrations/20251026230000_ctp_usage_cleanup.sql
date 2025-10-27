-- 20251026230000_ctp_usage_cleanup.sql
-- Consolidate inventory usage side-effects to a single trigger that
-- maintains both plant CTP totals and inventory item quantities.

begin;

-- Remove the legacy trigger/function that also adjusted CTP to avoid double application.
drop trigger if exists trg_inv_usage_updates_ctp on public.inventory_item_usages;
drop function if exists public.fn_inv_usage_updates_ctp();

-- Ensure the CTP trigger also keeps inventory quantities in sync.
create or replace function public.fn_ctp_usage_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric;
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
    -- Remove the old contribution first.
    v_cost := coalesce(fn_item_effective_unit_cost(coalesce(OLD.item_id, NEW.item_id)), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    -- Apply the new contribution.
    v_cost := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;

    if NEW.item_id is not null then
      -- If the item changed, recompute for the new id as well.
      if NEW.item_id is distinct from OLD.item_id then
        perform public.fn_recalc_item_qty(NEW.item_id);
      else
        perform public.fn_recalc_item_qty(NEW.item_id);
      end if;
    end if;

    return NEW;
  end if;

  return null;
end;
$$;

commit;
