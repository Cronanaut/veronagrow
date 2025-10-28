import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

function sanitizeUnitCost(unitCost: number | undefined): number | undefined {
  if (unitCost === undefined) return undefined;
  if (!Number.isFinite(unitCost)) return undefined;
  return unitCost;
}

export async function ensureWaterItem(
  userId: string,
  unitCost?: number,
  client?: SupabaseClient
) {
  const db = client ?? supabase;

  let resolvedUnitCost = sanitizeUnitCost(unitCost);

  if (resolvedUnitCost === undefined) {
    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('water_cost_per_unit')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('Failed to load profile water cost:', profileErr.message);
    } else if (profile) {
      resolvedUnitCost = sanitizeUnitCost(profile.water_cost_per_unit ?? undefined);
    }
  }

  const { data, error } = await db
    .from('inventory_items')
    .select('id, is_persistent')
    .eq('user_id', userId)
    .eq('name', 'Water')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to look up Water inventory item:', error.message);
    return;
  }

  const rows = data ?? [];
  const [primary, ...duplicates] = rows;

  // Clean up any duplicates that slipped through
  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      const dupId = dup.id;
      if (!dupId) continue;

      const { error: demoteErr } = await db
        .from('inventory_items')
        .update({ is_persistent: false })
        .eq('id', dupId);
      if (demoteErr) {
        console.error('Failed to demote duplicate Water item:', demoteErr.message);
        continue;
      }

      const { error: deleteErr } = await db
        .from('inventory_items')
        .delete()
        .eq('id', dupId);
      if (deleteErr) {
        console.error('Failed to delete duplicate Water item:', deleteErr.message);
      }
    }
  }

  if (!primary) {
    const { error: insertErr } = await db.from('inventory_items').insert({
      user_id: userId,
      name: 'Water',
      unit: 'gal',
      category: 'Water',
      unit_cost: resolvedUnitCost ?? 0,
      is_persistent: true,
    });
    if (insertErr) {
      console.error('Failed to insert Water inventory item:', insertErr.message);
    }
    return;
  }

  const updates: Record<string, unknown> = {
    unit: 'gal',
    category: 'Water',
    is_persistent: true,
  };
  if (resolvedUnitCost !== undefined) {
    updates.unit_cost = resolvedUnitCost;
  }

  const { error: updateErr } = await db
    .from('inventory_items')
    .update(updates)
    .eq('id', primary.id);

  if (updateErr) {
    console.error('Failed to update Water inventory item:', updateErr.message);
  }
}
