'use client';

export type Usage = {
  id: string;
  qty: number;
  note: string;
  used_at: string | null;
  plant_name: string | null;
};

export default function UsageHistoryCard({ usage }: { usage: Usage[] }) {
  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Usage history</h2>
      <div className="divide-y divide-neutral-800 rounded border">
        {usage.length === 0 ? (
          <div className="p-3 text-neutral-400">No usage yet.</div>
        ) : (
          usage.map((u) => (
            <div key={u.id} className="p-3 grid grid-cols-4 gap-4">
              <div>{u.qty}</div>
              <div>{u.plant_name ?? '—'}</div>
              <div>{u.used_at ? new Date(u.used_at).toLocaleString() : '—'}</div>
              <div className="truncate" title={u.note}>
                {u.note || '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}