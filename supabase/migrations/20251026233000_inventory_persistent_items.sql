-- 20251026233000_inventory_persistent_items.sql
-- Support persistent inventory items (e.g., Water) that cannot be deleted and never deplete.

begin;

-- Column flag
alter table public.inventory_items
  add column if not exists is_persistent boolean not null default false;

-- qty helper respects persistent flag
create or replace function public.fn_recalc_item_qty(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in            numeric := 0;
  v_out           numeric := 0;
  v_is_persistent boolean := false;
begin
  select coalesce(is_persistent, false)
    into v_is_persistent
  from public.inventory_items
  where id = p_item_id;

  if v_is_persistent then
    -- Persistent items always report infinite stock; leave qty unchanged.
    return;
  end if;

  select coalesce(sum(qty), 0) into v_in
    from public.inventory_item_lots
   where item_id = p_item_id;

  select coalesce(sum(qty), 0) into v_out
    from public.inventory_item_usages
   where item_id = p_item_id;

  update public.inventory_items
     set qty = coalesce(v_in, 0) - coalesce(v_out, 0)
   where id = p_item_id;
end;
$$;

-- Lots trigger stays the single entry point for qty recompute
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

-- Usage trigger also keeps qty and CTP in sync
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
    v_cost  := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
    v_delta := coalesce(NEW.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = coalesce(ctp_total, 0) + v_delta
     where id = NEW.plant_batch_id;

    if NEW.item_id is not null then
      perform public.fn_recalc_item_qty(NEW.item_id);
    end if;

    return NEW;

  elsif (tg_op = 'DELETE') then
    v_cost  := coalesce(fn_item_effective_unit_cost(OLD.item_id), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    if OLD.item_id is not null then
      perform public.fn_recalc_item_qty(OLD.item_id);
    end if;

    return OLD;

  elsif (tg_op = 'UPDATE') then
    v_cost  := coalesce(fn_item_effective_unit_cost(coalesce(OLD.item_id, NEW.item_id)), 0);
    v_delta := coalesce(OLD.qty, 0) * v_cost;

    update public.plant_batches
       set ctp_total = greatest(0, coalesce(ctp_total, 0) - v_delta)
     where id = OLD.plant_batch_id;

    v_cost  := coalesce(fn_item_effective_unit_cost(NEW.item_id), 0);
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

-- Prevent deletion of persistent items
create or replace function public.fn_prevent_delete_persistent_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_persistent then
    raise exception 'Persistent inventory items cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_persistent_item on public.inventory_items;
create trigger trg_prevent_delete_persistent_item
before delete on public.inventory_items
for each row execute function public.fn_prevent_delete_persistent_item();

commit;
