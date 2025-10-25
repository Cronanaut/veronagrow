'use client';

import { useState, FormEvent } from 'react';

export type Lot = {
  id: string;
  qty: number | null;
  unit_cost: number | null;
  lot_code: string | null;
  created_at: string | null;
  received_at?: string | null;
};

type Props = {
  lots: Lot[];
  onAddLot: (input: { lot_code: string; quantity: number; received_at?: string | null }) => Promise<void>;
};

export default function LotsCard({ lots, onAddLot }: Props) {
  const [lotCode, setLotCode] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [receivedAt, setReceivedAt] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAdding(true);
    setErr(null);
    try {
      await onAddLot({
        lot_code: lotCode.trim(),
        quantity: Number(quantity) || 0,
        received_at: receivedAt ? receivedAt : null,
      });
      setLotCode('');
      setQuantity(0);
      setReceivedAt('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not add lot';
      setErr(message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <h2 className="mb-3 text-xl font-semibold">Lots</h2>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-4">
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Lot code"
          value={lotCode}
          onChange={(e) => setLotCode(e.target.value)}
        />
        <input
          type="number"
          className="rounded-lg border px-3 py-2 w-32"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          min={0}
          step="any"
        />
        <input
          type="date"
          className="rounded-lg border px-3 py-2"
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
        />
        <button
          type="submit"
          disabled={adding || !lotCode}
          className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add lot'}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </form>

      <ul className="divide-y">
        {lots.length === 0 && <li className="text-sm text-gray-500">No lots yet.</li>}
        {lots.map((l) => (
          <li key={l.id} className="py-2 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-medium">{l.lot_code || '(no code)'}</div>
              <div className="text-sm text-gray-600">
                Qty: {l.qty ?? 0} · Unit cost: {l.unit_cost ?? 0}
              </div>
            </div>
            <div className="text-sm text-gray-500">{formatDate(l.received_at ?? l.created_at)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}