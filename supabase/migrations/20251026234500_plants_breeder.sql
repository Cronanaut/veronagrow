-- Add breeder metadata to plant batches.

begin;

alter table public.plant_batches
  add column if not exists breeder text;

commit;
