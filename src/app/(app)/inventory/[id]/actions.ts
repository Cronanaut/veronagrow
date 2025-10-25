'use server';

import { createClient } from '@/utils/supabase';

export async function saveItemAction(
  id: string,
  updates: Partial<{ name: string; quantity: number; unit: string; price_per_unit: number }>
) {
  const supabase = createClient();

  const { error } = await supabase
    .from('inventory_items')
    .update({
      name: updates.name,
      unit: updates.unit,
      unit_cost: updates.price_per_unit,
      qty: updates.quantity,
    })
    .eq('id', id);

  if (error) throw new Error(`Save failed: ${error.message}`);
}

export async function addLotAction(
  itemId: string,
  input: { lot_code: string; quantity: number; received_at?: string | null }
) {
  const supabase = createClient();

  const { error } = await supabase.from('inventory_item_lots').insert({
    item_id: itemId,
    lot_code: input.lot_code,
    qty: input.quantity,
    received_at: input.received_at ?? null,
  });

  if (error) throw new Error(`Add lot failed: ${error.message}`);
}