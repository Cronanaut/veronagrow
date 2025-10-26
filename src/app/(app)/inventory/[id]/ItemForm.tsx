'use client';

import React, { useState } from 'react';

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  category: string;
  // Read-only display; calculated from lots
  unit_cost: number | null;
};

type Props = {
  item: InventoryItem;
  onSave: (updates: { name?: string; unit?: string; category?: string }) => Promise<void>;
};

export default function ItemForm({ item, onSave }: Props) {
  const [name, setName] = useState(item.name ?? '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        unit: unit.trim(),
        category: category.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Name</span>
          <input
            className="rounded-md border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Part A Nutrient"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Unit of Measure</span>
          <input
            className="rounded-md border px-3 py-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. mL, g, oz"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Category</span>
          <input
            className="rounded-md border px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Nutrient"
          />
        </label>

        {/* Read-only price per unit (driven by lots) */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Price / Unit</span>
          <div className="rounded-md border px-3 py-2 bg-neutral-50">
            {item.unit_cost != null ? `$${Number(item.unit_cost).toFixed(2)}` : '—'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}