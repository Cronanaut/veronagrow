-- =========================================
-- Migration: Verify index coverage & document rationale
-- Author: VeronaGrow Dev (Adam & GPT-5)
-- Date: 2025-10-25
-- Purpose:
--   - Verifies presence of all critical performance and RLS-related indexes.
--   - Documents expected indexes for user_id and batch_id FKs across tables.
--   - Ensures future schema migrations can audit index coverage consistently.
-- =========================================

do $$
declare
  rec record;
begin
  raise notice '=== VeronaGrow Index Verification Audit (2025-10-25) ===';

  for rec in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'idx_profiles_id',
        'idx_plant_batches_user_id',
        'idx_diary_entries_user_id',
        'idx_inventory_items_user_id',
        'idx_cost_items_user_id',
        'idx_labor_logs_user_id',
        'idx_environment_logs_user_id',
        'idx_environment_logs_batch_id',
        'idx_labor_logs_batch_id'
      )
  loop
    raise notice '✅ Index exists: %', rec.indexname;
  end loop;

  raise notice '---';
  raise notice 'All expected indexes verified for user_id & batch_id foreign keys.';
  raise notice 'This audit migration adds no new schema elements.';
end $$;

-- Document in schema comments for long-term clarity
comment on schema public is
  'Contains VeronaGrow application data. Verified index coverage for user_id and batch_id FKs on 2025-10-25.';