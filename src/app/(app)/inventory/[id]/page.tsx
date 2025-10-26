import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import createServerSupabase from '@/utils/supabase/supabase-server'; // 👈 point to existing helper
import ItemForm, { type InventoryItem } from './ItemForm';

export async function saveItemAction(
  id: string,
  updates: { name?: string; unit?: string; category?: string }
) {
  'use server';
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from('inventory_items')
    .update({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/inventory/${id}`);
}

export default async function InventoryItemPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const { data: itemRow, error: itemErr } = await supabase
    .from('inventory_items')
    .select('id,name,unit,category,unit_cost')
    .eq('id', id)
    .single();

  if (itemErr || !itemRow) return notFound();

  const item: InventoryItem = {
    id: itemRow.id,
    name: itemRow.name ?? '',
    unit: itemRow.unit ?? '',
    category: itemRow.category ?? '',
    unit_cost: itemRow.unit_cost ?? null,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Item Details</h1>
        <Link href="/inventory" className="underline">
          Back to inventory
        </Link>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <ItemForm
          item={item}
          onSave={async (u) => {
            'use server';
            await saveItemAction(id, u);
          }}
        />
      </div>
    </div>
  );
}