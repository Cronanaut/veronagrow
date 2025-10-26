-- =========================================================
-- CTP (Cost-To-Produce) for plants
-- - Adds plant_batches.ctp_total
-- - Updates ctp_total automatically whenever an inventory usage is recorded
-- - Keeps inventory_items.qty in sync when lots/usages change
-- - Keeps inventory_items.unit_cost synced to the lot's unit_cost
-- =========================================================

-- 1) Column on plants
alter table public.plant_batches
  add column if not exists ctp_total numeric not null default 0;

-- 2) Helper: recalc item.qty = sum(lots.qty) - sum(usages.qty)
create or replace function public.fn_recalc_item_qty(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in  numeric;
  v_out numeric;
  v_qty numeric;
begin
  select coalesce(sum(qty), 0) into v_in
  from public.inventory_item_lots
  where item_id = p_item_id;

  select coalesce(sum(qty), 0) into v_out
  from public.inventory_item_usages
  where item_id = p_item_id;

  v_qty := coalesce(v_in,0) - coalesce(v_out,0);

  update public.inventory_items
     set qty = v_qty
   where id = p_item_id;
end;
$$;

-- 3) Trigger: whenever LOTS change, recalc item.qty
create or replace function public.fn_lot_recalc_item_qty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.fn_recalc_item_qty(old.item_id);
    return old;
  else
    perform public.fn_recalc_item_qty(new.item_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_lot_recalc_qty on public.inventory_item_lots;
create trigger trg_lot_recalc_qty
after insert or update or delete on public.inventory_item_lots
for each row execute function public.fn_lot_recalc_item_qty();

-- 4) Trigger: keep inventory_items.unit_cost in sync with lot.unit_cost (last touched lot wins)
create or replace function public.fn_lot_updates_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') or (tg_op = 'UPDATE' and (new.unit_cost is distinct from old.unit_cost)) then
    update public.inventory_items
       set unit_cost = new.unit_cost
     where id = new.item_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_lot_updates_item_cost on public.inventory_item_lots;
create trigger trg_lot_updates_item_cost
after insert or update of unit_cost on public.inventory_item_lots
for each row execute function public.fn_lot_updates_item_cost();

-- 5) Trigger: when a usage is recorded, bump plant_batches.ctp_total by qty * item.unit_cost
--    NOTE: does NOT assume inventory_item_usages has user_id
create or replace function public.fn_inv_usage_updates_ctp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_cost numeric;
  v_amount    numeric;
begin
  select unit_cost into v_unit_cost
    from public.inventory_items
   where id = new.item_id
   limit 1;

  v_amount := coalesce(new.qty, 0) * coalesce(v_unit_cost, 0);

  -- Bump the plant's CTP
  update public.plant_batches
     set ctp_total = coalesce(ctp_total, 0) + coalesce(v_amount, 0)
   where id = new.plant_batch_id;

  -- Keep item.qty in sync (usage reduces available)
  perform public.fn_recalc_item_qty(new.item_id);

  return new;
end;
$$;

drop trigger if exists trg_inv_usage_updates_ctp on public.inventory_item_usages;
create trigger trg_inv_usage_updates_ctp
after insert on public.inventory_item_usages
for each row execute function public.fn_inv_usage_updates_ctp();

-- 6) Optional backfill for existing data (safe to re-run)
do $$
declare r record;
begin
  update public.plant_batches set ctp_total = 0;

  for r in
    select u.plant_batch_id, sum(u.qty * coalesce(i.unit_cost,0)) as amt
      from public.inventory_item_usages u
      join public.inventory_items i on i.id = u.item_id
     group by u.plant_batch_id
  loop
    update public.plant_batches
       set ctp_total = coalesce(ctp_total,0) + coalesce(r.amt,0)
     where id = r.plant_batch_id;
  end loop;
end$$;