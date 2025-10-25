// app/(app)/inventory/[id]/page.tsx
import { createClient } from '@/utils/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ItemForm, { type InventoryItem } from './ItemForm';
import LotsCard, { type Lot } from './LotsCard';
import UsageHistoryCard, { type Usage } from './UsageHistoryCard';
import { saveItemAction, addLotAction } from './actions';

type ItemRow = {
  id: string;
  name: string | null;
  unit: string | null;
  unit_cost: number | null;
  qty: number | null;
  category: string | null;
};

export default async function InventoryItemPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // Fetch item details
  const { data: item } = (await supabase
    .from('inventory_items')
    .select('id,name,unit,unit_cost,qty,category')
    .eq('id', id)
    .single()) as { data: ItemRow | null };

  if (!item) return notFound();

  // Fetch related lots and usage
  const [{ data: lots }, { data: usages }] = await Promise.all([
    supabase
      .from('inventory_item_lots')
      .select('id,qty,unit_cost,lot_code,created_at,received_at')
      .eq('item_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('inventory_item_usages')
      .select('id,qty,note,used_at,plant_batch_id,plant_batches(name)')
      .eq('item_id', id)
      .order('used_at', { ascending: false }),
  ]);

  // Prepare UI models
  const uiItem: InventoryItem = {
    id,
    name: item.name ?? '',
    quantity: item.qty ?? 0,
    unit: item.unit ?? '',
    price_per_unit: item.unit_cost ?? 0,
  };

  const lotsList: Lot[] = (lots as unknown as Lot[]) ?? [];
  const usageList: Usage[] = (usages as unknown as Usage[]) ?? [];

  // Server actions
  const saveItem = async (updates: Partial<InventoryItem>) => {
    'use server';
    await saveItemAction(id, updates);
  };

  const addLot = async (input: { lot_code: string; quantity: number; received_at?: string | null }) => {
    'use server';
    await addLotAction(id, input);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{uiItem.name || 'Inventory item'}</h1>
        <Link href="/inventory" className="underline">
          Back to inventory
        </Link>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border p-4">
          <h2 className="mb-3 text-xl font-semibold">Item</h2>
          <ItemForm item={uiItem} onSave={saveItem} />
        </div>

        <LotsCard lots={lotsList} onAddLot={addLot} />
        <UsageHistoryCard usage={usageList} />
      </div>
    </div>
  );
}