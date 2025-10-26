'use client';

import { useState } from 'react';

export type Lot = {
  id: string;
  qty: number;
  unit_cost: number | null;
  lot_code: string | null;
  received_at: string | null;
  created_at: string | null;
};

export default function LotsCard({
  lots,
  onAddLot,
}: {
  lots: Lot[];
  onAddLot: (input: {
    lot_code?: string;
    quantity: number;
    received_at?: string | null;
    unit_cost?: number | null;
  }) => Promise<void>;
}) {
  const [qty, setQty] = useState<number>(0);
  const [code, setCode] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    await onAddLot({
      lot_code: code || undefined,
      quantity: qty,
      unit_cost: cost ? Number(cost) : null,
      received_at: date || null,
    });
    setQty(0);
    setCode('');
    setCost('');
    setDate('');
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Lots</h2>

      <div className="flex gap-3 items-end">
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
          <span className="text-sm text-neutral-400">Lot code</span>
          <input
            className="rounded border bg-black p-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Unit cost</span>
          <input
            type="number"
            step="0.01"
            className="rounded border bg-black p-2"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-neutral-400">Received</span>
          <input
            type="date"
            className="rounded border bg-black p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="rounded bg-white text-black px-4 py-2 disabled:opacity-60" onClick={add} disabled={saving}>
          {saving ? 'Adding…' : 'Add lot'}
        </button>
      </div>

      <div className="divide-y divide-neutral-800 rounded border">
        {lots.length === 0 ? (
          <div className="p-3 text-neutral-400">No lots yet.</div>
        ) : (
          lots.map((l) => (
            <div key={l.id} className="p-3 flex gap-6 items-center">
              <div className="w-28">{l.qty}</div>
              <div className="w-40">{l.lot_code ?? '—'}</div>
              <div className="w-40">{l.unit_cost != null ? `$${l.unit_cost.toFixed(2)}` : '—'}</div>
              <div className="flex-1">{l.received_at ? new Date(l.received_at).toLocaleDateString() : '—'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}