'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

type Item = {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  qty: number;
};

export default function ApplyInventoryPage() {
  return (
    <RequireAuth>
      <ApplyInventoryInner />
    </RequireAuth>
  );
}

function ApplyInventoryInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const plantId = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : params?.id), [params]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, unit, unit_cost, qty')
        .order('name', { ascending: true });
      if (error) setErr(error.message);
      else setItems((data ?? []) as Item[]);
      setLoading(false);
    })();
  }, []);

  async function apply(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!selected) return setErr('Choose an inventory item.');
    const qtyNum = Number(qty);
    if (Number.isNaN(qtyNum) || qtyNum <= 0) return setErr('Quantity must be > 0.');

    setApplying(true);
    try {
      const { error } = await supabase.rpc('apply_inventory_to_batch', {
        p_inventory_item_id: selected,
        p_batch_id: plantId,
        p_qty: qtyNum,
      });
      if (error) {
        setErr(error.message);
        setApplying(false);
        return;
      }
      router.push(`/plants/${plantId}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Apply Inventory</h1>
        <Link className="underline" href={`/plants/${plantId}`}>← Back</Link>
      </header>

      {loading && <p className="text-gray-600">Loading…</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded border p-4 text-gray-700">
          No inventory yet. Add one first:
          <Link className="ml-2 underline" href="/inventory/new">+ Add Item</Link>
        </div>
      )}

      {items.length > 0 && (
        <form onSubmit={apply} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm">Item</label>
            <select
              className="w-full rounded border p-2"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">— Select —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (in stock: {it.qty} {it.unit}, ${it.unit_cost.toFixed(2)}/{it.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Quantity to apply</label>
            <input
              className="w-full rounded border p-2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="e.g., 20"
              required
            />
          </div>

          <button className="rounded bg-black px-3 py-2 text-white disabled:opacity-60" disabled={applying}>
            {applying ? 'Applying…' : 'Apply to plant'}
          </button>
        </form>
      )}
    </main>
  );
}