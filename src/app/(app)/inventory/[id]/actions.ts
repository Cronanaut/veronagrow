'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import createServerSupabase from '@/utils/supabase-server'; // ✅ server client

const ItemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.string().optional(),
  price_per_unit: z.coerce.number().min(0).optional(),
  category: z.string().nullable().optional(),
});

const LotInsertSchema = z.object({
  lot_code: z.string().min(1),
  quantity: z.coerce.number().min(0.000001),
  received_at: z.string().min(1).or(z.string().datetime()).or(z.null()).optional(),
  unit_cost: z.coerce.number().min(0).nullable().optional(), // 👈 allow entering unit cost
});

const UsageInsertSchema = z.object({
  plant_batch_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  note: z.string().default(''),
  used_at: z.string().min(1).or(z.string().datetime()).optional(),
});

/** Update basic item fields */
export async function saveItemAction(itemId: string, formData: FormData) {
  const supabase = createServerSupabase();

  const { data: itemRow, error: itemErr } = await supabase
    .from('inventory_items')
    .select('is_persistent')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!itemRow) return { ok: false, error: 'Item not found' };
  if (itemRow.is_persistent) {
    return { ok: false, error: 'This item is managed automatically.' };
  }

  const parsed = ItemUpdateSchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price_per_unit: formData.get('price_per_unit'),
    category: formData.get('category'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  const v = parsed.data;
  const updates: Record<string, unknown> = {};
  if (v.name !== undefined) updates.name = v.name;
  if (v.quantity !== undefined) updates.qty = v.quantity;
  if (v.unit !== undefined) updates.unit = v.unit;
  if (v.price_per_unit !== undefined) updates.unit_cost = v.price_per_unit;
  if (v.category !== undefined) updates.category = v.category;

  const { error } = await supabase.from('inventory_items').update(updates).eq('id', itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Add a lot (receipt) to this item */
export async function addLotAction(itemId: string, formData: FormData) {
  const supabase = createServerSupabase();

  const parsed = LotInsertSchema.safeParse({
    lot_code: formData.get('lot_code'),
    quantity: formData.get('quantity'),
    received_at: formData.get('received_at'),
    unit_cost: formData.get('unit_cost'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  const { lot_code, quantity, received_at, unit_cost } = parsed.data;

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr) return { ok: false, error: uerr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const { data: itemRow, error: itemRowErr } = await supabase
    .from('inventory_items')
    .select('is_persistent')
    .eq('id', itemId)
    .maybeSingle();
  if (itemRowErr) return { ok: false, error: itemRowErr.message };
  if (!itemRow) return { ok: false, error: 'Item not found' };
  if (itemRow.is_persistent) {
    return { ok: false, error: 'This item has unlimited stock; lots are disabled.' };
  }

  const baseInsert: Record<string, unknown> = {
    item_id: itemId,
    lot_code,
    qty: quantity,
    unit_cost: unit_cost ?? null, // optional cost
    received_at: received_at ?? null,
    user_id: user.id,
  };

  let insertErr: { message: string } | null = null;
  const { error } = await supabase.from('inventory_item_lots').insert(baseInsert);
  insertErr = error;

  if (insertErr?.message?.toLowerCase().includes('user_id')) {
    const fallbackInsert = { ...baseInsert };
    delete fallbackInsert.user_id;
    const { error: fallbackErr } = await supabase.from('inventory_item_lots').insert(fallbackInsert);
    insertErr = fallbackErr ?? null;
  }

  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Record usage of this item against a plant batch */
export async function consumeItemAction(itemId: string, formData: FormData) {
  const supabase = createServerSupabase();

  const parsed = UsageInsertSchema.safeParse({
    plant_batch_id: formData.get('plant_batch_id'),
    quantity: formData.get('quantity'),
    note: (formData.get('note') as string) ?? '',
    used_at: formData.get('used_at') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };

  const { plant_batch_id, quantity, note, used_at } = parsed.data;

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr) return { ok: false, error: uerr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const usedAtIso = used_at ?? new Date().toISOString();

  const { data: itemMeta, error: itemMetaErr } = await supabase
    .from('inventory_items')
    .select('name, unit')
    .eq('id', itemId)
    .maybeSingle();
  if (itemMetaErr) return { ok: false, error: itemMetaErr.message };
  if (!itemMeta) return { ok: false, error: 'Inventory item not found' };

  const {
    data: usageRecord,
    error: usageErr,
  } = await supabase
    .from('inventory_item_usages')
    .insert({
      item_id: itemId,
      plant_batch_id,
      qty: quantity,
      note,
      used_at: usedAtIso,
      user_id: user.id,
    })
    .select('id')
    .single();
  if (usageErr) return { ok: false, error: usageErr.message };

  const usageId = usageRecord?.id ?? null;

  if (plant_batch_id) {
    const unitLabel = itemMeta.unit ? itemMeta.unit.trim() : '';
    const qtyLabel = Number.isFinite(quantity) ? String(quantity) : `${quantity}`;
    const baseLine = `Applied ${qtyLabel} ${unitLabel || 'units'} of ${itemMeta.name ?? 'inventory item'}`;
    const details = note?.trim() ? `${baseLine}\n\n${note.trim()}` : baseLine;
    const entryDate = usedAtIso.slice(0, 10);

    const basePayload: Record<string, unknown> = {
      plant_batch_id,
      user_id: user.id,
      entry_date: entryDate,
      note: details,
    };
    const fallbackPayload: Record<string, unknown> = {
      batch_id: plant_batch_id,
      user_id: user.id,
      entry_date: entryDate,
      note: details,
    };
    if (usageId) {
      basePayload.inventory_usage_id = usageId;
      fallbackPayload.inventory_usage_id = usageId;
    }

    const payloadVariants: Record<string, unknown>[] = [basePayload, fallbackPayload];
    let diaryErr: { message: string; code?: string } | null = null;
    let insertedDiary = false;

    for (const payload of payloadVariants) {
      const { error: attemptErr } = await supabase.from('diary_entries').insert(payload);
      if (!attemptErr) {
        insertedDiary = true;
        diaryErr = null;
        break;
      }

      diaryErr = attemptErr;
      const msg = attemptErr.message?.toLowerCase() ?? '';

      if (msg.includes('inventory_usage_id')) {
        delete payload.inventory_usage_id;
        payloadVariants.forEach((p) => delete p.inventory_usage_id);
        const { error: retryErr } = await supabase.from('diary_entries').insert(payload);
        if (!retryErr) {
          insertedDiary = true;
          diaryErr = null;
          break;
        }
        diaryErr = retryErr;
      }

      if (!msg.includes('plant_batch_id') && !msg.includes('batch_id') && !msg.includes('inventory_usage_id')) {
        break;
      }
    }

    if (!insertedDiary && diaryErr) {
      return { ok: false, error: `Usage saved but diary entry failed: ${diaryErr.message}` };
    }
  }

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Delete a specific lot */
export async function deleteLotAction(itemId: string, lotId: string) {
  const supabase = createServerSupabase();

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr) return { ok: false, error: uerr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const { data: itemRow, error: itemErr } = await supabase
    .from('inventory_items')
    .select('is_persistent')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!itemRow) return { ok: false, error: 'Item not found' };
  if (itemRow.is_persistent) {
    return { ok: false, error: 'This item has unlimited stock; lots are disabled.' };
  }

  const { error } = await supabase
    .from('inventory_item_lots')
    .delete()
    .eq('id', lotId)
    .eq('item_id', itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Delete a usage record */
export async function deleteUsageAction(itemId: string, usageId: string) {
  const supabase = createServerSupabase();

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr) return { ok: false, error: uerr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase
    .from('inventory_item_usages')
    .delete()
    .eq('id', usageId)
    .eq('item_id', itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Delete an inventory item (non-persistent only) */
export async function deleteItemAction(itemId: string) {
  const supabase = createServerSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return { ok: false, error: userErr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const { data: itemRow, error: itemErr } = await supabase
    .from('inventory_items')
    .select('is_persistent')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!itemRow) return { ok: false, error: 'Item not found' };
  if (itemRow.is_persistent) {
    return { ok: false, error: 'This item is managed automatically and cannot be deleted.' };
  }

  const { error: deleteErr } = await supabase.from('inventory_items').delete().eq('id', itemId);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  revalidatePath('/inventory');
  return { ok: true };
}
