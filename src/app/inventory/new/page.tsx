'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

export default function NewInventoryPage() {
  return (
    <RequireAuth>
      <NewInventoryInner />
    </RequireAuth>
  );
}

function NewInventoryInner() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('ml'); // ml, g, pcs
  const [unitCost, setUnitCost] = useState<string>('0.00');
  const [qty, setQty] = useState<string>('0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) return setErr('Please enter a name.');
    if (!unit.trim()) return setErr('Please enter a unit.');

    const unit_cost_num = Number(unitCost);
    const qty_num = Number(qty);
    if (Number.isNaN(unit_cost_num) || unit_cost_num < 0) return setErr('Unit cost must be a non-negative number.');
    if (Number.isNaN(qty_num) || qty_num < 0) return setErr('Quantity must be a non-negative number.');

    setSaving(true);
    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setErr(uErr?.message ?? 'Please sign in first.');
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('inventory_items').insert({
        user_id: u.user.id,
        name: name.trim(),
        category: category.trim() || null,
        unit: unit.trim(),
        unit_cost: unit_cost_num,
        qty: qty_num,
      });
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }

      window.location.href = '/inventory';
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-bold">Add Inventory Item</h1>

      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">Name</label>
          <input
            className="w-full rounded border p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., CalMag, 3-gal pot, Seeds"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Category (optional)</label>
          <input
            className="w-full rounded border p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="nutrients / pots / seeds"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="mb-1 block text-sm">Unit</label>
            <input
              className="w-full rounded border p-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="ml / g / pcs"
              required
            />
          </div>
          <div className="col-span-1">
            <label className="mb-1 block text-sm">Unit cost ($)</label>
            <input
              className="w-full rounded border p-2"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div className="col-span-1">
            <label className="mb-1 block text-sm">Quantity</label>
            <input
              className="w-full rounded border p-2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex items-center gap-3">
          <button className="rounded bg-black px-3 py-2 text-white disabled:opacity-60" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link className="underline" href="/inventory">Cancel</Link>
        </div>
      </form>
    </main>
  );
}