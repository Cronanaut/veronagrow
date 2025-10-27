'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Usage = {
  id: string;
  qty: number;
  used_at: string | null;
  note: string | null;
  plant_name: string | null;
};

type Props = {
  usage: Usage[];
  onDelete: (usageId: string) => Promise<void>;
};

export default function UsageHistoryCard({ usage, onDelete }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (deletingId) return;
    const ok = window.confirm('Delete this usage record? Inventory and CTP will be updated.');
    if (!ok) return;

    setDeletingId(id);
    try {
      await onDelete(id);
      router.refresh();
    } catch (err) {
      alert((err as Error).message || 'Failed to delete usage');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-lg font-semibold mb-3">Usage History</h3>
      {usage.length === 0 ? (
        <div className="text-sm text-neutral-500">No usage yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Plant</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{u.used_at?.slice(0, 10) ?? '—'}</td>
                  <td className="py-2 pr-3">{u.plant_name ?? '—'}</td>
                  <td className="py-2 pr-3">{formatQuantity(u.qty)}</td>
                  <td className="py-2 pr-3">{u.note ?? ''}</td>
                  <td className="py-2 pr-3 text-right">
                    <button
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => handleDelete(u.id)}
                      disabled={deletingId === u.id}
                    >
                      {deletingId === u.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatQuantity(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
