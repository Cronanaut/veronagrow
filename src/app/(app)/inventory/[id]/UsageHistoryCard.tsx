// src/app/(app)/inventory/[id]/UsageHistoryCard.tsx
'use client';

import { useState } from 'react';

export type Usage = {
  id: string;
  qty: number | null;
  note: string | null;
  used_at: string | null; // ISO
  plant_batch_id: string | null;
  plant_batches?: { name: string | null } | null;
};

export type BatchOption = { id: string; name: string };

type Props = {
  usage: Usage[];
  batches: BatchOption[];
  onAddUsage: (input: {
    plant_batch_id: string;
    quantity: number;
    note?: string;
    used_at?: string;
  }) => Promise<void>;
};

export default function UsageHistoryCard({ usage, batches, onAddUsage }: Props) {
  const [plantBatchId, setPlantBatchId] = useState<string>(batches[0]?.id ?? '');
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [usedAt, setUsedAt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!plantBatchId) {
      setErr('Select a plant');
      return;
    }
    if (quantity <= 0) {
      setErr('Quantity must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      await onAddUsage({
        plant_batch_id: plantBatchId,
        quantity,
        note: note || undefined,
        used_at: usedAt || undefined,
      });
      // reset fields
      setQuantity(0);
      setNote('');
      setUsedAt('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <h2 className="text-xl font-semibold">Usage</h2>

      {/* Add usage form */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Apply to Plant</label>
          <select
            className="w-full rounded border p-2"
            value={plantBatchId}
            onChange={(e) => setPlantBatchId(e.target.value)}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Quantity</label>
          <input
            type="number"
            className="w-full rounded border p-2"
            value={Number.isFinite(quantity) ? quantity : 0}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={0}
            step="any"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Used At (optional)</label>
          <input
            type="datetime-local"
            className="w-full rounded border p-2"
            value={usedAt}
            onChange={(e) => setUsedAt(e.target.value)}
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-sm mb-1">Note (optional)</label>
          <input
            type="text"
            className="w-full rounded border p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Weekly feeding"
          />
        </div>

        <div className="md:col-span-4 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-black text-white px-3 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Apply to Plant'}
          </button>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </div>

      {/* History table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Plant</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Note</th>
            </tr>
          </thead>
          <tbody>
            {usage.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-neutral-500">
                  No usage yet.
                </td>
              </tr>
            ) : (
              usage.map((u) => {
                const d = u.used_at ? new Date(u.used_at) : null;
                const when = d ? d.toLocaleString() : '—';
                return (
                  <tr key={u.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{when}</td>
                    <td className="py-2 pr-4">
                      {u.plant_batches?.name || u.plant_batch_id || '—'}
                    </td>
                    <td className="py-2 pr-4">{u.qty ?? '—'}</td>
                    <td className="py-2 pr-4">{u.note ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}