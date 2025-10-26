-- 20251026224500_items_unit_cost_nullable.sql
-- Make inventory_items.unit_cost nullable, safely (only if currently NOT NULL)

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'inventory_items'
      and column_name  = 'unit_cost'
      and is_nullable  = 'NO'
  ) then
    alter table public.inventory_items
      alter column unit_cost drop not null;
  end if;
end$$;