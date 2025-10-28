-- Ensure each user has at most one persistent Water inventory item.

begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, name
      order by created_at
    ) as rn
  from public.inventory_items
  where name = 'Water'
)
delete from public.inventory_items
where id in (
  select id
  from ranked
  where rn > 1
);

create unique index if not exists inventory_items_user_water_unique
  on public.inventory_items(user_id)
  where name = 'Water' and user_id is not null;

commit;
