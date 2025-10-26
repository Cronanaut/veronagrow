'use server';

// src/app/(app)/inventory/[id]/actions.ts
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/utils/supabase'; // ✅ use our unified helper

const ItemUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.string().optional(),
  price_per_unit: z.coerce.number().min(0).optional(),
  category: z.string().nullable().optional(),
});

const LotInsertSchema = z.object({
  lot_code: z.string().min(1, 'Lot code is required'),
  quantity: z.coerce.number().min(0.000001, 'Quantity must be > 0'),
  received_at: z
    .string()
    .datetime()
    .or(z.string().min(1))
    .or(z.null())
    .optional()
    .transform((v) => (v ? v : null)),
});

const UsageInsertSchema = z.object({
  plant_batch_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  note: z.string().default(''),
  used_at: z
    .string()
    .datetime()
    .or(z.string().min(1))
    .optional(),
});

/** Update basic item fields */
export async function saveItemAction(itemId: string, formData: FormData) {
  const supabase = createClient();

  const parsed = ItemUpdateSchema.safeParse({
    name: formData.get('name'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    price_per_unit: formData.get('price_per_unit'),
    category: formData.get('category'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const updates: Record<string, unknown> = {};
  const v = parsed.data;

  if (v.name !== undefined) updates.name = v.name;
  if (v.quantity !== undefined) updates.qty = v.quantity;
  if (v.unit !== undefined) updates.unit = v.unit;
  if (v.price_per_unit !== undefined) updates.unit_cost = v.price_per_unit;
  if (v.category !== undefined) updates.category = v.category;

  const { error } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', itemId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}

/** Add a lot (receipt) to this item */
export async function addLotAction(itemId: string, formData: FormData) {
  const supabase = createClient();

  const parsed = LotInsertSchema.safeParse({
    lot_code: formData.get('lot_code'),
    quantity: formData.get('quantity'),
    received_at: formData.get('received_at'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { lot_code, quantity, received_at } = parsed.data;

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
    unit_cost: null,
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
  const supabase = createClient();

  const parsed = UsageInsertSchema.safeParse({
    plant_batch_id: formData.get('plant_batch_id'),
    quantity: formData.get('quantity'),
    note: (formData.get('note') as string) ?? '',
    used_at: formData.get('used_at') ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { plant_batch_id, quantity, note, used_at } = parsed.data;

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr) return { ok: false, error: uerr.message };
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase.from('inventory_item_usages').insert({
    item_id: itemId,
    plant_batch_id,
    qty: quantity,
    note,
    used_at: used_at ?? new Date().toISOString(),
    user_id: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/${itemId}`);
  revalidatePath('/inventory');
  return { ok: true };
}