-- Add harvest tracking to plant batches.

begin;

alter table public.plant_batches
  add column if not exists harvested_at timestamptz,
  add column if not exists yield_bud numeric(12,3),
  add column if not exists yield_trim numeric(12,3);

commit;
