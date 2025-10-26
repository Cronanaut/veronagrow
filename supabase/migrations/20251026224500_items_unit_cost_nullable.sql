-- Make unit_cost optional since price comes from latest lot
alter table public.inventory_items
  alter column unit_cost drop not null,
  alter column unit_cost drop default;

-- Ensure qty defaults to 0 for new items (so we can omit it at create)
alter table public.inventory_items
  alter column qty set default 0;