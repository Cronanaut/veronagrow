'use client';

export type Usage = {
  id: string;
  qty: number | null;
  note: string | null;
  used_at: string | null; // ISO
  plant_batch_id: string | null;
  plant_batches?: { name: string | null } | null;
};

type Props = {
  usage: Usage[];
};

export default function UsageHistoryCard({ usage }: Props) {
  return (
    <div className="rounded-2xl border p-4">
      <h2 className="mb-3 text-xl font-semibold">Usage history</h2>
      {usage.length === 0 ? (
        <p className="text-sm text-gray-500">No usage recorded for this item.</p>
      ) : (
        <ul className="divide-y">
          {usage.map((u) => (
            <li key={u.id} className="py-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {u.qty ?? 0} used {u.plant_batches?.name ? `→ ${u.plant_batches.name}` : ''}
                  </div>
                  {u.note && <div className="text-sm text-gray-600">{u.note}</div>}
                </div>
                <div className="text-sm text-gray-500">{formatDate(u.used_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}