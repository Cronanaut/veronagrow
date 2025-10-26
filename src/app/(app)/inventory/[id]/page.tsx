'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/utils/supabase';
import ItemForm from './ItemForm';
import LotsCard, { Lot } from './LotsCard';
import UsageHistoryCard, { Usage } from './UsageHistoryCard';
import RecordUsageForm from './RecordUsageForm';

type Item = {
  id: string;
  name: string | null;
  qty: number | null;
  unit: string | null;
  unit_cost: number | null;
  category: string | null;
};

type Plant = { id: string; name: string | null };

type UsageRow = {
  id: string;
  qty: number;
  note: string | null;
  used_at: string | null;
  plant_batches: { name: string | null } | null;
};

export default function InventoryItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [item, setItem] = useState<Item | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  // Ensure auth before loading
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setSessionReady(true);
      if (!uid) router.push('/signin');
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const load = async () => {
    if (!id) return;
    setLoading(true);

    const [{ data: itemRow }, { data: lotsRows }, { data: usageRows }, { data: plantRows }] =
      await Promise.all([
        supabase
          .from('inventory_items')
          .select('id,name,qty,unit,unit_cost,category')
          .eq('id', id)
          .single(),
        supabase
          .from('inventory_item_lots')
          .select('id,qty,unit_cost,lot_code,received_at,created_at')
          .eq('item_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventory_item_usages')
          .select('id,qty,note,used_at,plant_batch_id,plant_batches(name)')
          .eq('item_id', id)
          .order('used_at', { ascending: false }),
        supabase.from('plant_batches').select('id,name').order('name'),
      ]);

    setItem(itemRow ?? null);
    setLots((lotsRows as Lot[]) ?? []);

    const mapped: Usage[] =
      (usageRows as UsageRow[] | null)?.map((u) => ({
        id: u.id,
        qty: u.qty,
        note: u.note ?? '',
        used_at: u.used_at,
        plant_name: u.plant_batches?.name ?? '—',
      })) ?? [];

    setUsage(mapped);
    setPlants((plantRows as Plant[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionReady) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, id]);

  const title = useMemo(() => item?.name ?? 'Inventory item', [item]);

  // UPDATE item
  async function onSaveItem(updates: {
    name?: string;
    qty?: number;
    unit?: string;
    unit_cost?: number;
    category?: string;
  }) {
    if (!id || !userId) return;

    const { error } = await supabase
      .from('inventory_items')
      .update({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.qty !== undefined ? { qty: updates.qty } : {}),
        ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
        ...(updates.unit_cost !== undefined ? { unit_cost: updates.unit_cost } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      alert(`Save failed: ${error.message}`);
    } else {
      await load();
    }
  }

  // ADD LOT
  async function onAddLot(input: {
    lot_code?: string;
    quantity: number;
    received_at?: string | null;
    unit_cost?: number | null;
  }) {
    if (!id || !userId) return;

    const { error } = await supabase.from('inventory_item_lots').insert({
      item_id: id,
      user_id: userId,
      qty: input.quantity,
      unit_cost: input.unit_cost ?? null,
      lot_code: input.lot_code ?? null,
      received_at: input.received_at ?? null,
    });

    if (error) {
      alert(`Add lot failed: ${error.message}`);
    } else {
      await load();
    }
  }

  // RECORD USAGE
  async function onRecordUsage(input: {
    plant_batch_id: string;
    quantity: number;
    note?: string;
    used_at?: string;
  }) {
    if (!id || !userId) return;

    const { error: useErr } = await supabase.from('inventory_item_usages').insert({
      item_id: id,
      user_id: userId,
      qty: input.quantity,
      plant_batch_id: input.plant_batch_id,
      note: input.note ?? '',
      used_at: input.used_at ?? null,
    });

    if (useErr) {
      alert(`Record usage failed: ${useErr.message}`);
      return;
    }

    // Simple (non-atomic) decrement; fine for now
    const newQty = (item?.qty ?? 0) - input.quantity;
    const { error: updErr } = await supabase
      .from('inventory_items')
      .update({ qty: newQty })
      .eq('id', id)
      .eq('user_id', userId);

    if (updErr) {
      alert(`Quantity update failed: ${updErr.message}`);
    }

    await load();
  }

  if (!sessionReady) return null;
  if (loading) return <div className="p-6">Loading…</div>;
  if (!item) return <div className="p-6">Item not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{title.toUpperCase()}</h1>
        <Link href="/inventory" className="underline">
          Back to inventory
        </Link>
      </div>

      <div className="rounded-2xl border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-sm text-neutral-400">Quantity</div>
            <div className="text-lg">{item.qty ?? 0}</div>
            <div className="text-sm text-neutral-400 mt-4">Price / Unit</div>
            <div className="text-lg">
              {item.unit_cost != null ? `$${(item.unit_cost as number).toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Unit</div>
            <div className="text-lg">{item.unit ?? '—'}</div>
            <div className="text-sm text-neutral-400 mt-4">Category</div>
            <div className="text-lg">{item.category ?? '—'}</div>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-900 border p-4 text-neutral-300">
          Editing, lots, and usage history below.
        </div>
      </div>

      <ItemForm
        item={{
          id: item.id,
          name: item.name ?? '',
          quantity: item.qty ?? 0,
          unit: item.unit ?? '',
          price_per_unit: item.unit_cost ?? 0,
          category: item.category ?? '',
        }}
        onSave={onSaveItem}
      />

      <RecordUsageForm plants={plants} onRecord={onRecordUsage} />

      <LotsCard lots={lots} onAddLot={onAddLot} />

      <UsageHistoryCard usage={usage} />
    </div>
  );
}