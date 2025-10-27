'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

type Batch = {
  id: string;
  name: string;
  stage: string | null;
  start_date: string; // ISO date (YYYY-MM-DD)
  lineage: string | null;
  breeder: string | null;
  harvested_at: string | null;
  yield_bud: number | null;
  yield_trim: number | null;
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

      const baseQuery = supabase
        .from('plant_batches')
        .select('id, name, stage, start_date, strain, breeder, harvested_at, yield_bud, yield_trim')
        .order('created_at', { ascending: false });

      const { data, error } = await baseQuery;

      let result: any[] | null = (data ?? null) as any[] | null;
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('breeder')) {
          const fallback = await supabase
            .from('plant_batches')
            .select('id, name, stage, start_date, strain, harvested_at, yield_bud, yield_trim')
            .order('created_at', { ascending: false });
          if (fallback.error) {
            setErr(fallback.error.message);
            setLoading(false);
            return;
          }
          result = (fallback.data ?? null) as any[] | null;
        } else {
          setErr(error.message);
          setLoading(false);
          return;
        }
      }

      const mapped = (result ?? []).map((row: any) => ({
        id: row.id as string,
        name: row.name as string,
        stage: (row.stage as string | null) ?? null,
        start_date: row.start_date as string,
        lineage: (row.strain as string | null) ?? null,
        breeder: (row.breeder as string | null) ?? null,
        harvested_at: (row.harvested_at as string | null) ?? null,
        yield_bud: row.yield_bud != null ? Number(row.yield_bud) : null,
        yield_trim: row.yield_trim != null ? Number(row.yield_trim) : null,
      })) as Batch[];
      setRows(mapped);
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

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Active Plants</h2>
        {rows.filter((r) => !r.harvested_at).length === 0 ? (
          <p className="text-sm text-gray-600">No active plants.</p>
        ) : (
          <ul className="space-y-2">
            {rows
              .filter((r) => !r.harvested_at)
              .map((r) => (
                <li key={r.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <a href={`/plants/${r.id}`} className="font-medium underline">
                      {r.name}
                    </a>
                    <span className="text-sm text-gray-600">{formatStage(r.stage)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Plant Date: {formatDate(r.start_date)}
                    {r.lineage ? ` • Lineage: ${r.lineage}` : ''}
                    {r.breeder ? ` • Breeder: ${r.breeder}` : ''}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Harvested Plants</h2>
        {rows.filter((r) => r.harvested_at).length === 0 ? (
          <p className="text-sm text-gray-600">No harvested plants yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows
              .filter((r) => r.harvested_at)
              .map((r) => (
                <li key={r.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <a href={`/plants/${r.id}`} className="font-medium underline">
                      {r.name}
                    </a>
                    <span className="text-sm text-gray-600">Harvested: {formatDate(r.harvested_at)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Bud yield: {formatYield(r.yield_bud)} • Trim yield: {formatYield(r.yield_trim)}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
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

function formatYield(value: number | null | undefined) {
  if (value == null) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
