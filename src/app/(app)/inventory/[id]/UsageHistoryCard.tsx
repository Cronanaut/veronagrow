'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Plant = { id: string; name: string | null };

type Props = {
  plants: Plant[];
  onRecord: (input: {
    plant_batch_id: string;
    quantity: number;
    note?: string;
    used_at?: string;
  }) => Promise<void>;
};

export default function RecordUsageForm({ plants, onRecord }: Props) {
  const router = useRouter();
  const [plantId, setPlantId] = useState<string>('');
  const [qty, setQty] = useState<string>('0');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!plantId || !Number.isFinite(n) || n <= 0) return;

    setSaving(true);
    try {
      await onRecord({
        plant_batch_id: plantId,
        quantity: n,
        note: note || undefined,
        used_at: date || undefined,
      });
      router.refresh();
      // reset
      setQty('0');
      setDate('');
      setNote('');
      setPlantId('');
    } catch (err) {
      alert((err as Error).message || 'Failed to record usage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Record Usage</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="col-span-1 md:col-span-1 rounded-md border bg-transparent p-2"
            aria-label="Plant"
          >
            <option value="">Select a plant…</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? 'Untitled plant'}
              </option>
            ))}
          </select>

          <input
            type="number"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="rounded-md border bg-transparent p-2"
            placeholder="Quantity"
            aria-label="Quantity"
            min="0"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border bg-transparent p-2"
            aria-label="Date (optional)"
          />

          <button
            type="submit"
            disabled={saving}
            className="rounded-md border px-3 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record usage'}
          </button>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border bg-transparent p-2"
          placeholder="Note (optional)"
          rows={3}
        />
      </form>
    </div>
  );
}