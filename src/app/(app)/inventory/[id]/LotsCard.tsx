'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Lot = {
  id: string;
  lot_code: string | null;
  quantity: number;
  unit_cost: number | null;
  received_at: string | null;
  created_at: string | null;
};

type AddInput = {
  lot_code?: string;
  quantity: number;
  received_at?: string | null;
  unit_cost?: number | null;
};

type Patch = {
  lot_code?: string | null;
  quantity?: number;
  received_at?: string | null;
  unit_cost?: number | null;
};

type Props = {
  lots: Lot[];
  onAddLot: (input: AddInput) => Promise<void>;
  onUpdateLot: (lotId: string, patch: Patch) => Promise<void>;
};

export default function LotsCard({ lots, onAddLot, onUpdateLot }: Props) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddInput>({
    lot_code: today,
    quantity: 0,
    received_at: today,
    unit_cost: null,
  });

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.quantity || form.quantity <= 0) {
      alert('Enter a quantity > 0');
      return;
    }
    try {
      await onAddLot(form);
      router.refresh();
      setForm({ lot_code: today, quantity: 0, received_at: today, unit_cost: null });
      setAdding(false);
    } catch (err) {
      alert((err as Error).message || 'Failed to add lot');
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Lots</h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md border px-3 py-1 text-sm"
        >
          {adding ? 'Cancel' : 'Add Lot'}
        </button>
      </div>

      {adding && (
        <form onSubmit={submitAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-neutral-500">Lot Code</label>
            <input
              className="rounded-md border px-3 py-2"
              value={form.lot_code ?? ''}
              onChange={(e) => setForm((s) => ({ ...s, lot_code: e.target.value }))}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-neutral-500">Quantity</label>
            <input
              type="number"
              min={0}
              step="any"
              className="rounded-md border px-3 py-2"
              value={form.quantity}
              onChange={(e) => setForm((s) => ({ ...s, quantity: Number(e.target.value) }))}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-neutral-500">Unit Cost</label>
            <input
              type="number"
              min={0}
              step="any"
              className="rounded-md border px-3 py-2"
              value={form.unit_cost ?? ''}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  unit_cost: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-neutral-500">Received</label>
            <input
              type="date"
              className="rounded-md border px-3 py-2"
              value={form.received_at ?? ''}
              onChange={(e) => setForm((s) => ({ ...s, received_at: e.target.value }))}
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button className="rounded-md border px-4 py-2">Save Lot</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2 pr-2">Lot</th>
              <th className="py-2 pr-2">Quantity</th>
              <th className="py-2 pr-2">Unit Cost</th>
              <th className="py-2 pr-2">Received</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <Row key={lot.id} lot={lot} onUpdateLot={onUpdateLot} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  lot,
  onUpdateLot,
}: {
  lot: Lot;
  onUpdateLot: (lotId: string, patch: { lot_code?: string | null; quantity?: number; received_at?: string | null; unit_cost?: number | null }) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    lot_code: lot.lot_code ?? '',
    quantity: lot.quantity,
    unit_cost: lot.unit_cost ?? null,
    received_at: lot.received_at ?? '',
  });

  async function save() {
    try {
      await onUpdateLot(lot.id, {
        lot_code: draft.lot_code,
        quantity: draft.quantity,
        unit_cost: draft.unit_cost,
        received_at: draft.received_at || null,
      });
      router.refresh();
      setEditing(false);
    } catch (err) {
      alert((err as Error).message || 'Failed to update lot');
    }
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-2">
        {editing ? (
          <input
            className="rounded-md border px-2 py-1 w-full"
            value={draft.lot_code ?? ''}
            onChange={(e) => setDraft((s) => ({ ...s, lot_code: e.target.value }))}
          />
        ) : (
          lot.lot_code || '—'
        )}
      </td>
      <td className="py-2 pr-2">
        {editing ? (
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-md border px-2 py-1 w-full"
            value={draft.quantity}
            onChange={(e) => setDraft((s) => ({ ...s, quantity: Number(e.target.value) }))}
          />
        ) : (
          lot.quantity
        )}
      </td>
      <td className="py-2 pr-2">
        {editing ? (
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-md border px-2 py-1 w-full"
            value={draft.unit_cost ?? ''}
            onChange={(e) =>
              setDraft((s) => ({
                ...s,
                unit_cost: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
          />
        ) : (
          lot.unit_cost != null ? `$${Number(lot.unit_cost).toFixed(2)}` : '—'
        )}
      </td>
      <td className="py-2 pr-2">
        {editing ? (
          <input
            type="date"
            className="rounded-md border px-2 py-1 w-full"
            value={draft.received_at ?? ''}
            onChange={(e) => setDraft((s) => ({ ...s, received_at: e.target.value }))}
          />
        ) : (
          lot.received_at ?? '—'
        )}
      </td>
      <td className="py-2 pr-2 text-right">
        <button
          className="rounded-md border px-2 py-1 text-xs"
          onClick={() => (editing ? save() : setEditing(true))}
        >
          {editing ? 'Save' : '✏️ Edit'}
        </button>
        {editing && (
          <button
            className="ml-2 rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              setEditing(false);
              setDraft({
                lot_code: lot.lot_code ?? '',
                quantity: lot.quantity,
                unit_cost: lot.unit_cost ?? null,
                received_at: lot.received_at ?? '',
              });
            }}
          >
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}