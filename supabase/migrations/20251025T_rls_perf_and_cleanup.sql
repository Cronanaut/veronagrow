-- =========================
-- RLS: performance + cleanup
-- =========================
-- Strategy:
-- 1) Enable RLS on all user-data tables (no-op if already enabled)
-- 2) DROP duplicate / old policies by name (IF EXISTS)
-- 3) CREATE a single clear policy per action, scoped TO authenticated
-- 4) Use (select auth.uid()) in USING / WITH CHECK to avoid initplan re-eval

-- ---------- PROFILES ----------
alter table public.profiles enable row level security;

drop policy if exists "profiles are self" on public.profiles;
drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles upsert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

-- Read own profile
create policy "profiles_select_own"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Insert own profile row
create policy "profiles_insert_own"
  on public.profiles
  as permissive
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Update own profile row
create policy "profiles_update_own"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- (Optional) DELETE own profile — usually unnecessary, omit unless you support delete
-- create policy "profiles_delete_own"
--   on public.profiles
--   as permissive
--   for delete
--   to authenticated
--   using (id = (select auth.uid()));

-- ---------- PLANT BATCHES ----------
alter table public.plant_batches enable row level security;

drop policy if exists "batch is owner" on public.plant_batches;
drop policy if exists "pb sel own" on public.plant_batches;
drop policy if exists "pb ins own" on public.plant_batches;
drop policy if exists "pb upd own" on public.plant_batches;
drop policy if exists "pb del own" on public.plant_batches;

create policy "pb_select_own"
  on public.plant_batches
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "pb_insert_own"
  on public.plant_batches
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "pb_update_own"
  on public.plant_batches
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pb_delete_own"
  on public.plant_batches
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- DIARY ENTRIES ----------
alter table public.diary_entries enable row level security;

drop policy if exists "diary is owner" on public.diary_entries;
drop policy if exists "de sel own" on public.diary_entries;
drop policy if exists "de ins own" on public.diary_entries;
drop policy if exists "de upd own" on public.diary_entries;
drop policy if exists "de del own" on public.diary_entries;
drop policy if exists "Users can read their own diary entries" on public.diary_entries;
drop policy if exists "Users can insert their own diary entries" on public.diary_entries;
drop policy if exists "Users can delete their own diary entries" on public.diary_entries;

create policy "de_select_own"
  on public.diary_entries
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "de_insert_own"
  on public.diary_entries
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "de_update_own"
  on public.diary_entries
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "de_delete_own"
  on public.diary_entries
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- INVENTORY ITEMS ----------
alter table public.inventory_items enable row level security;

drop policy if exists "inv sel own" on public.inventory_items;
drop policy if exists "inv ins own" on public.inventory_items;
drop policy if exists "inv upd own" on public.inventory_items;
drop policy if exists "inv del own" on public.inventory_items;

create policy "inv_select_own"
  on public.inventory_items
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "inv_insert_own"
  on public.inventory_items
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "inv_update_own"
  on public.inventory_items
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "inv_delete_own"
  on public.inventory_items
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- COST ITEMS ----------
alter table public.cost_items enable row level security;

drop policy if exists "cost is owner" on public.cost_items;
drop policy if exists "cost sel own" on public.cost_items;
drop policy if exists "cost ins own" on public.cost_items;
drop policy if exists "cost upd own" on public.cost_items;
drop policy if exists "cost del own" on public.cost_items;

create policy "cost_select_own"
  on public.cost_items
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "cost_insert_own"
  on public.cost_items
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "cost_update_own"
  on public.cost_items
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cost_delete_own"
  on public.cost_items
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- LABOR LOGS ----------
alter table public.labor_logs enable row level security;

drop policy if exists "labor is owner" on public.labor_logs;
drop policy if exists "labor sel own" on public.labor_logs;
drop policy if exists "labor ins own" on public.labor_logs;
drop policy if exists "labor upd own" on public.labor_logs;
drop policy if exists "labor del own" on public.labor_logs;

create policy "labor_select_own"
  on public.labor_logs
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "labor_insert_own"
  on public.labor_logs
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "labor_update_own"
  on public.labor_logs
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "labor_delete_own"
  on public.labor_logs
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- ENVIRONMENT LOGS ----------
alter table public.environment_logs enable row level security;

drop policy if exists "env is owner" on public.environment_logs;
drop policy if exists "env sel own" on public.environment_logs;
drop policy if exists "env ins own" on public.environment_logs;
drop policy if exists "env upd own" on public.environment_logs;
drop policy if exists "env del own" on public.environment_logs;

create policy "env_select_own"
  on public.environment_logs
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "env_insert_own"
  on public.environment_logs
  as permissive
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "env_update_own"
  on public.environment_logs
  as permissive
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "env_delete_own"
  on public.environment_logs
  as permissive
  for delete
  to authenticated
  using (user_id = (select auth.uid()));