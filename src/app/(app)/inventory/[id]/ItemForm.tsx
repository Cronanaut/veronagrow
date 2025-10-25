'use client';

import { useMemo, useState, FormEvent } from 'react';

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
};

type Props = {
  item: InventoryItem;
  onSave: (updates: Partial<InventoryItem>) => Promise<void>;
};

export default function ItemForm({ item, onSave }: Props) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [unit, setUnit] = useState(item.unit);
  const [pricePerUnit, setPricePerUnit] = useState<number>(item.price_per_unit);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const changed = useMemo(() => {
    return (
      name !== item.name ||
      quantity !== item.quantity ||
      unit !== item.unit ||
      pricePerUnit !== item.price_per_unit
    );
  }, [name, quantity, unit, pricePerUnit, item]);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!changed) return;
    setSaving(true);
    setMsg(null);
    try {
      await onSave({
        name,
        quantity,
        unit,
        price_per_unit: pricePerUnit,
      });
      setMsg('Saved.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setMsg(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Name</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CalMag"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Quantity</span>
          <input
            type="number"
            className="rounded-lg border px-3 py-2"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={0}
            step="any"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Unit (UoM)</span>
          <input
            className="rounded-lg border px-3 py-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. L, ml, g, kg"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Price per unit</span>
          <input
            type="number"
            className="rounded-lg border px-3 py-2"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(Number(e.target.value))}
            min={0}
            step="any"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!changed || saving}
          className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}