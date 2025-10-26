'use client';

import { useState } from 'react';

type Plant = { id: string; name: string | null };

export default function RecordUsageForm({
  plants,
  onRecord,
}: {
  plants: Plant[];
  onRecord: (input: {
    plant_batch_id: string;
    quantity: number;
    note?: string;
    used_at?: string;
  }) => Promise<void>;
}) {
  const [plantId, setPlantId] = useState<string>(plants[0]?.id ?? '');
  const [qty, setQty] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!plantId || qty <= 0) {
      alert('Choose a plant and a quantity > 0');
      return;
    }
    setSaving(true);
    await onRecord({
      plant_batch_id: plantId,
      quantity: qty,
      note: note || undefined,
      used_at: date || undefined,
    });
    setQty(0);
    setNote('');
    setDate('');
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Record usage</h2>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Plant</span>
          <select
            className="rounded border bg-black p-2 min-w-56"
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
          >
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.id}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Quantity</span>
          <input
            type="number"
            className="rounded border bg-black p-2"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Date (optional)</span>
          <input
            type="date"
            className="rounded border bg-black p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex-1 space-y-1 min-w-64">
          <span className="text-sm text-neutral-400">Note (optional)</span>
          <input
            className="w-full rounded border bg-black p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button
          className="rounded bg-white text-black px-4 py-2 disabled:opacity-60"
          onClick={submit}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Record usage'}
        </button>
      </div>
    </div>
  );
}