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

  const { error } = await supabase.from('inventory_item_lots').insert({
    item_id: itemId,
    lot_code,
    qty: quantity,
    unit_cost: unit_cost ?? null,        // 👈 persist optional cost
    received_at: received_at ?? null,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

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

  const { error } = await supabase.from('inventory_item_usages').insert({
    item_id: itemId,
    plant_batch_id,
    qty: quantity,
    note,
    used_at: usedAtIso,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  if (plant_batch_id) {
    const unitLabel = itemMeta.unit ? itemMeta.unit.trim() : '';
    const qtyLabel = Number.isFinite(quantity) ? String(quantity) : `${quantity}`;
    const baseLine = `Applied ${qtyLabel} ${unitLabel || 'units'} of ${itemMeta.name ?? 'inventory item'}`;
    const details = note?.trim() ? `${baseLine}\n\n${note.trim()}` : baseLine;
    const entryDate = usedAtIso.slice(0, 10);

    const diaryPayload: Record<string, unknown> = {
      plant_batch_id,
      user_id: user.id,
      entry_date: entryDate,
      note: details,
    };

    let diaryErr: { message: string; code?: string } | null = null;
    const { error: primaryDiaryErr } = await supabase.from('diary_entries').insert(diaryPayload);
    diaryErr = primaryDiaryErr;

    const needsFallback =
      !!diaryErr &&
      (
        diaryErr.code === '42703' ||
        diaryErr.message?.toLowerCase().includes('plant_batch_id') ||
        diaryErr.message?.toLowerCase().includes('content')
      );

    if (needsFallback) {
      // Column mismatch in legacy schema: retry with batch_id instead of plant_batch_id.
      const fallbackPayload: Record<string, unknown> = {
        batch_id: plant_batch_id,
        user_id: user.id,
        entry_date: entryDate,
        note: details,
      };
      const { error: fallbackErr } = await supabase.from('diary_entries').insert(fallbackPayload);
      diaryErr = fallbackErr ?? null;
    }

    if (diaryErr) return { ok: false, error: `Usage saved but diary entry failed: ${diaryErr.message}` };
  }

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}
