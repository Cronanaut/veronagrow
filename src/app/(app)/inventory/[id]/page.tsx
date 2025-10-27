import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import createServerSupabase from '@/utils/supabase-server';
import ItemForm, { type InventoryItem } from './ItemForm';
import LotsCard, { type Lot } from './LotsCard';
import RecordUsageForm from './RecordUsageForm';
import UsageHistoryCard from './UsageHistoryCard';
import {
  addLotAction,
  consumeItemAction,
  deleteLotAction,
  deleteUsageAction,
  deleteItemAction,
} from './actions';

// -------- helpers --------
type LotRow = {
  id: string;
  qty?: number | string | null;
  unit_cost?: number | null;
  lot_code?: string | null;
  received_at?: string | null;
  created_at?: string | null;
};

type PlantBatchRelation = { name?: string | null };

type UsageRow = {
  id: string;
  qty?: number | string | null;
  used_at?: string | null;
  note?: string | null;
  plant_batches?: PlantBatchRelation[] | PlantBatchRelation | null;
};

type PlantRow = { id: string; name: string | null };

function normalizeLotRows(rows: LotRow[] | null | undefined): Lot[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    lot_code: r.lot_code ?? null,
    quantity: Number(r.qty ?? 0),
    unit_cost: r.unit_cost ?? null,
    received_at: r.received_at ?? null,
    created_at: r.created_at ?? null,
  }));
}

function normalizeQuantity(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatQuantity(value: number | string | null | undefined): string {
  if (value === Infinity) return '∞';
  const amount = normalizeQuantity(value);
  if (amount === Infinity) return '∞';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type UsageNorm = {
  id: string;
  qty: number;
  used_at: string | null;
  note: string | null;
  plant_name: string | null;
};

// ---------------------- Page (server) ---------------------------
export default async function InventoryItemPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const itemId = resolvedParams.id;
  const supabaseClient = createServerSupabase();

  // 1) Item
  const { data: itemRow, error: itemErr } = await supabaseClient
    .from('inventory_items')
    .select('id,name,unit,category,unit_cost,qty,is_persistent')
    .eq('id', itemId)
    .single();

  if (itemErr || !itemRow) return notFound();

  const item: InventoryItem = {
    id: itemRow.id,
    name: itemRow.name ?? '',
    unit: itemRow.unit ?? '',
    category: itemRow.category ?? '',
    unit_cost: itemRow.unit_cost ?? null,
    is_persistent: Boolean(itemRow.is_persistent),
  };

  const quantityOnHand = item.is_persistent ? Infinity : normalizeQuantity(itemRow.qty);

  // 2) Lots, usage, plants
  const [lotResp, usageResp, plantResp] = await Promise.all([
    supabaseClient
      .from('inventory_item_lots')
      .select('id,qty,unit_cost,lot_code,received_at,created_at')
      .eq('item_id', itemId)
      .order('received_at', { ascending: false }),
    supabaseClient
      .from('inventory_item_usages')
      .select('id,qty,note,used_at,plant_batch_id,plant_batches(name)')
      .eq('item_id', itemId)
      .order('used_at', { ascending: false }),
    supabaseClient.from('plant_batches').select('id,name').order('name', { ascending: true }),
  ]);

  const lotRows = (lotResp.data ?? null) as LotRow[] | null;
  const usageRows = (usageResp.data ?? null) as UsageRow[] | null;
  const plantRows = (plantResp.data ?? null) as PlantRow[] | null;

  const lots: Lot[] = normalizeLotRows(lotRows);

  const usageRowsList: UsageRow[] = usageRows ?? [];
  const usage: UsageNorm[] = usageRowsList.map((u) => ({
    id: u.id,
    qty: Number(u.qty ?? 0),
    used_at: u.used_at ?? null,
    note: u.note ?? null,
    plant_name: Array.isArray(u.plant_batches)
      ? u.plant_batches[0]?.name ?? null
      : u.plant_batches?.name ?? null,
  }));

  const plantRowsList: PlantRow[] = plantRows ?? [];
  const plants = plantRowsList.map((p) => ({ id: p.id, name: p.name }));

  // -------- server actions exposed to client components --------
  async function saveItemActionLocal(
    updates: { name?: string; unit?: string; category?: string }
  ) {
    'use server';
    if (item.is_persistent) {
      return;
    }
    const s = createServerSupabase();
    const { error } = await s
      .from('inventory_items')
      .update({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
      })
      .eq('id', itemId);
    if (error) throw new Error(error.message);
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath('/inventory');
  }

  // wrap add-lot (your zod parser expects FormData)
  async function onAddLot(input: {
    lot_code?: string;
    quantity: number;
    received_at?: string | null;
    unit_cost?: number | null;
  }) {
    'use server';
    if (item.is_persistent) {
      throw new Error('This item has unlimited stock; lots are disabled.');
    }
    const fd = new FormData();
    if (input.lot_code) fd.set('lot_code', input.lot_code);
    fd.set('quantity', String(input.quantity));
    if (input.received_at) fd.set('received_at', input.received_at);
    if (input.unit_cost !== undefined && input.unit_cost !== null) {
      fd.set('unit_cost', String(input.unit_cost));
    }
    const res = await addLotAction(itemId, fd);
    if (!res?.ok) throw new Error(typeof res?.error === 'string' ? res.error : 'Add lot failed');
  }

  // inline update-lot (so ✏️ Edit works)
  async function onUpdateLot(
    lotId: string,
    patch: { lot_code?: string | null; quantity?: number; received_at?: string | null; unit_cost?: number | null }
  ) {
    'use server';
    if (item.is_persistent) {
      throw new Error('This item has unlimited stock; lots are disabled.');
    }
    const s = createServerSupabase();
    const updates: Record<string, unknown> = {};
    if (patch.lot_code !== undefined) updates.lot_code = patch.lot_code;
    if (patch.quantity !== undefined) updates.qty = patch.quantity;
    if (patch.unit_cost !== undefined) updates.unit_cost = patch.unit_cost;
    if (patch.received_at !== undefined) updates.received_at = patch.received_at;
    const { error } = await s.from('inventory_item_lots').update(updates).eq('id', lotId);
    if (error) throw new Error(error.message);
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath('/inventory');
  }

  async function onDeleteLot(lotId: string) {
    'use server';
    if (item.is_persistent) {
      throw new Error('This item has unlimited stock; lots are disabled.');
    }
    const res = await deleteLotAction(itemId, lotId);
    if (!res?.ok) throw new Error(typeof res?.error === 'string' ? res.error : 'Delete lot failed');
  }

  // wrap record-usage (zod expects FormData)
  async function onRecordUsage(input: {
    plant_batch_id: string;
    quantity: number;
    note?: string;
    used_at?: string;
  }) {
    'use server';
    const fd = new FormData();
    fd.set('plant_batch_id', input.plant_batch_id);
    fd.set('quantity', String(input.quantity));
    if (input.note) fd.set('note', input.note);
    if (input.used_at) fd.set('used_at', input.used_at);
    const res = await consumeItemAction(itemId, fd);
    if (!res?.ok) throw new Error(typeof res?.error === 'string' ? res.error : 'Record usage failed');
  }

  async function onDeleteUsage(usageId: string) {
    'use server';
    const res = await deleteUsageAction(itemId, usageId);
    if (!res?.ok) throw new Error(typeof res?.error === 'string' ? res.error : 'Delete usage failed');
  }

  async function onDeleteItem() {
    'use server';
    const res = await deleteItemAction(itemId);
    if (!res?.ok) throw new Error(typeof res?.error === 'string' ? res.error : 'Delete item failed');
    redirect('/inventory');
  }

  // ----------------- render -----------------
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Item Details</h1>
        <div className="flex items-center gap-3">
          {!item.is_persistent && (
            <form action={onDeleteItem}>
              <button
                type="submit"
                className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete item
              </button>
            </form>
          )}
          <Link href="/inventory" className="underline">
            Back to inventory
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-emerald-50/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700">On Hand</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {formatQuantity(quantityOnHand)} {item.unit || ''}
          </p>
        </div>
        <div className="rounded-2xl border px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Unit Cost</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {item.unit_cost != null ? formatCurrency(item.unit_cost) : '—'}
          </p>
        </div>
      </div>

      {/* Item edit */}
      <div className="rounded-2xl border p-4 space-y-4">
        <ItemForm item={item} onSave={saveItemActionLocal} />
      </div>

      {/* Lots */}
      {!item.is_persistent ? (
        <LotsCard
          lots={lots}
          onAddLot={onAddLot}
          onUpdateLot={onUpdateLot}
          onDeleteLot={onDeleteLot}
        />
      ) : (
        <div className="rounded-2xl border p-4 text-sm text-neutral-600">
          Lots are disabled for this persistent item.
        </div>
      )}

      {/* Record Usage */}
      <RecordUsageForm plants={plants} onRecord={onRecordUsage} />

      {/* Usage history */}
      <UsageHistoryCard usage={usage} onDelete={onDeleteUsage} />
    </div>
  );
}
