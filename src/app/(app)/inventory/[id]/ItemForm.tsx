'use client';

import { useState } from 'react';

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  category?: string;
};

export default function ItemForm({
  item,
  onSave,
}: {
  item: InventoryItem;
  onSave: (updates: Partial<InventoryItem>) => Promise<void>;
}) {
  const [form, setForm] = useState<InventoryItem>(item);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof InventoryItem>(key: K, v: InventoryItem[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({
      name: form.name,
      qty: form.quantity as unknown as number,
      unit: form.unit,
      unit_cost: form.price_per_unit as unknown as number,
      category: form.category,
    } as unknown as Partial<InventoryItem>);
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Edit item</h2>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Name</span>
          <input
            className="w-full rounded border bg-black p-2"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Category</span>
          <input
            className="w-full rounded border bg-black p-2"
            value={form.category ?? ''}
            onChange={(e) => set('category', e.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Quantity</span>
          <input
            type="number"
            className="w-full rounded border bg-black p-2"
            value={form.quantity}
            onChange={(e) => set('quantity', Number(e.target.value))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Unit</span>
          <input
            className="w-full rounded border bg-black p-2"
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
          />
        </label>

        <label className="space-y-1 col-span-2">
          <span className="text-sm text-neutral-400">Price per Unit</span>
          <input
            type="number"
            step="0.01"
            className="w-full rounded border bg-black p-2"
            value={form.price_per_unit}
            onChange={(e) => set('price_per_unit', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          className="rounded bg-white text-black px-4 py-2 disabled:opacity-60"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}