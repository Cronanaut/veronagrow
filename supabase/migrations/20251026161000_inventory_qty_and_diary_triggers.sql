-- 20251026161000_inventory_qty_and_diary_triggers.sql
-- Auto-maintain inventory_items.qty from lots & usages
-- Add a diary entry when usage is recorded
-- (Optional) Insert cost into cost_items if that table/columns exist

set search_path = public, extensions, pg_temp;

-- ---------- Qty maintenance: LOTS ----------
create or replace function public.fn_inv_qty_from_lots()
returns trigger
language plpgsql as $$
declare
  delta numeric := 0;
  old_item uuid;
  new_item uuid;
begin
  if (tg_op = 'INSERT') then
    delta := coalesce(new.qty,0);
    new_item := new.item_id;
    update public.inventory_items
      set qty = coalesce(qty,0) + delta
      where id = new_item;
    return null;
  elsif (tg_op = 'UPDATE') then
    -- handle possible item change (rare)
    old_item := old.item_id;
    new_item := new.item_id;

    if new_item = old_item then
      delta := coalesce(new.qty,0) - coalesce(old.qty,0);
      update public.inventory_items
        set qty = coalesce(qty,0) + delta
        where id = new_item;
    else
      -- moved lot to a different item: subtract from old, add to new
      update public.inventory_items
        set qty = coalesce(qty,0) - coalesce(old.qty,0)
        where id = old_item;
      update public.inventory_items
        set qty = coalesce(qty,0) + coalesce(new.qty,0)
        where id = new_item;
    end if;

    return null;
  elsif (tg_op = 'DELETE') then
    old_item := old.item_id;
    update public.inventory_items
      set qty = coalesce(qty,0) - coalesce(old.qty,0)
      where id = old_item;
    return null;
  end if;

  return null;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_inv_qty_from_lots'
  ) then
    create trigger trg_inv_qty_from_lots
      after insert or update or delete on public.inventory_item_lots
      for each row execute function public.fn_inv_qty_from_lots();
  end if;
end$$;

-- ---------- Qty maintenance: USAGES ----------
create or replace function public.fn_inv_qty_from_usages()
returns trigger
language plpgsql as $$
declare
  delta numeric := 0;
  old_item uuid;
  new_item uuid;
begin
  if (tg_op = 'INSERT') then
    update public.inventory_items
      set qty = coalesce(qty,0) - coalesce(new.qty,0)
      where id = new.item_id;
    return null;

  elsif (tg_op = 'UPDATE') then
    old_item := old.item_id;
    new_item := new.item_id;

    if new_item = old_item then
      delta := coalesce(old.qty,0) - coalesce(new.qty,0); -- subtract more if new > old
      update public.inventory_items
        set qty = coalesce(qty,0) + delta
        where id = new_item;
    else
      -- moved usage to a different item
      update public.inventory_items
        set qty = coalesce(qty,0) + coalesce(old.qty,0)
        where id = old_item;

      update public.inventory_items
        set qty = coalesce(qty,0) - coalesce(new.qty,0)
        where id = new_item;
    end if;
    return null;

  elsif (tg_op = 'DELETE') then
    update public.inventory_items
      set qty = coalesce(qty,0) + coalesce(old.qty,0)
      where id = old.item_id;
    return null;
  end if;

  return null;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_inv_qty_from_usages'
  ) then
    create trigger trg_inv_qty_from_usages
      after insert or update or delete on public.inventory_item_usages
      for each row execute function public.fn_inv_qty_from_usages();
  end if;
end$$;

-- ---------- Diary (and optional costs) on USAGE INSERT ----------
create or replace function public.fn_inv_usage_side_effects()
returns trigger
language plpgsql as $$
declare
  v_item_name text;
  v_unit text;
  v_note text;
  v_entry_date date;
  v_unit_cost numeric;
  v_amount numeric;

  has_cost_items boolean;
  has_batch_col boolean;
  batch_col text;
  amount_col text;
  note_col text;
begin
  -- pull item info
  select name, unit, unit_cost
    into v_item_name, v_unit, v_unit_cost
  from public.inventory_items
  where id = new.item_id;

  v_entry_date := coalesce(new.used_at::date, now()::date);
  v_note := format(
    'Applied %s %s of %s%s',
    coalesce(new.qty,0),
    coalesce(v_unit,''),
    coalesce(v_item_name,'item'),
    case when new.note is not null and length(new.note) > 0
         then format(' — %s', new.note) else '' end
  );

  -- diary entry
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='diary_entries')
  then
    insert into public.diary_entries (id, batch_id, user_id, note, entry_date, created_at)
    values (gen_random_uuid(), new.plant_batch_id, new.user_id, v_note, v_entry_date, now());
  end if;

  -- OPTIONAL: write a cost row if cost_items is present.
  -- We try best-effort discovery of column names.
  select exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='cost_items')
    into has_cost_items;

  if has_cost_items then
    -- determine batch column
    select exists(select 1 from information_schema.columns
                  where table_schema='public' and table_name='cost_items' and column_name='batch_id')
      into has_batch_col;
    batch_col := case when has_batch_col then 'batch_id' else 'plant_batch_id' end;

    -- pick amount-like column
    if exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='cost_items' and column_name='amount')
    then
      amount_col := 'amount';
    elsif exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='cost_items' and column_name='cost')
    then
      amount_col := 'cost';
    elsif exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='cost_items' and column_name='total')
    then
      amount_col := 'total';
    else
      amount_col := null;
    end if;

    -- optional note/description column
    if exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='cost_items' and column_name='note')
    then
      note_col := 'note';
    elsif exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='cost_items' and column_name='description')
    then
      note_col := 'description';
    else
      note_col := null;
    end if;

    -- pick a unit cost: latest lot if present, fallback to item.unit_cost
    select unit_cost into v_unit_cost
    from public.inventory_item_lots
    where item_id = new.item_id
    order by coalesce(received_at, created_at) desc nulls last
    limit 1;

    v_unit_cost := coalesce(v_unit_cost, 0);
    if v_unit_cost = 0 then
      select coalesce(unit_cost,0) into v_unit_cost
      from public.inventory_items
      where id = new.item_id;
    end if;

    v_amount := coalesce(new.qty,0) * coalesce(v_unit_cost,0);

    if amount_col is not null then
      execute format(
        'insert into public.cost_items (id, user_id, %I, %I, created_at %s) values (gen_random_uuid(), $1, $2, $3, now() %s)',
        batch_col, amount_col,
        case when note_col is not null then format(', %I', note_col) else '' end,
        case when note_col is not null then ', $4' else '' end
      )
      using new.user_id, new.plant_batch_id, v_amount, v_note;
    end if;
  end if;

  return null;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_inv_usage_side_effects'
  ) then
    create trigger trg_inv_usage_side_effects
      after insert on public.inventory_item_usages
      for each row execute function public.fn_inv_usage_side_effects();
  end if;
end$$;