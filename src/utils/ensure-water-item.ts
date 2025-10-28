import { supabase } from '@/utils/supabase';

function sanitizeUnitCost(unitCost: number | undefined): number | undefined {
  if (unitCost === undefined) return undefined;
  if (!Number.isFinite(unitCost)) return undefined;
  return unitCost;
}

export async function ensureWaterItem(userId: string, unitCost?: number) {
  const unitCostSafe = sanitizeUnitCost(unitCost);

  const { data: existing, error: existingErr } = await supabase
    .from('inventory_items')
    .select('id, is_persistent')
    .eq('user_id', userId)
    .eq('name', 'Water')
    .maybeSingle();

  if (existingErr) {
    console.error('Failed to fetch Water inventory item:', existingErr.message);
    return;
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from('inventory_items').insert({
      user_id: userId,
      name: 'Water',
      unit: 'gal',
      category: 'Water',
      unit_cost: unitCostSafe ?? 0,
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
  if (unitCostSafe !== undefined) {
    updates.unit_cost = unitCostSafe;
  }

  const { error: updateErr } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', existing.id);

  if (updateErr) {
    console.error('Failed to update Water inventory item:', updateErr.message);
  }
}
