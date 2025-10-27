-- Add cost-setting fields to profiles.

begin;

alter table public.profiles
  add column if not exists water_cost_per_unit numeric(12,4) not null default 0,
  add column if not exists electricity_cost_per_kwh numeric(12,4) not null default 0,
  add column if not exists unit_system text not null default 'metric',
  add column if not exists temperature_unit text not null default 'C';

commit;
