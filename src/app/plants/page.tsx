'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

type Batch = {
  id: string;
  name: string;
  stage: string | null;
  start_date: string; // ISO date (YYYY-MM-DD)
  strain: string | null;
};

export default function PlantsPage() {
  return (
    <RequireAuth>
      <PlantsInner />
    </RequireAuth>
  );
}

function PlantsInner() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setErr(uErr?.message ?? 'Not signed in');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('plant_batches')
        .select('id, name, stage, start_date, strain')
        .order('created_at', { ascending: false });

      if (error) setErr(error.message);
      else setRows((data ?? []) as Batch[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Plants</h1>
        <Link href="/plants/new/">Add New Plant</Link>
      </header>

      {loading && <p className="text-gray-600">Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {!loading && !err && rows.length === 0 && (
        <div className="rounded border p-4 text-gray-700">
          No plants yet. Click <span className="font-medium">+ Add Plant</span> to create your first batch.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <a href={`/plants/${r.id}`} className="font-medium underline">
                {r.name}
              </a>
              <span className="text-sm text-gray-600">{formatStage(r.stage)}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Started: {formatDate(r.start_date)}
              {r.strain ? ` • Strain: ${r.strain}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function formatDate(iso: string | null | undefined) {
  // Keep as the plain YYYY-MM-DD to avoid timezone shifts in the UI
  return iso ?? '—';
}

function formatStage(stage: string | null) {
  return stage ?? '—';
}