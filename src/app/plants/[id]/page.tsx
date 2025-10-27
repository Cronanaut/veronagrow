'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

type Plant = {
  id: string;
  name: string;
  stage: string | null;
  start_date: string; // YYYY-MM-DD
  lineage: string | null;
  breeder: string | null;
  harvested_at: string | null;
  yield_bud: number | null;
  yield_trim: number | null;
  ctp_total: number | null;
};

type DiaryEntry = {
  id: string;
  note: string | null;
  created_at: string; // ISO timestamp
  entry_date: string | null; // optional YYYY-MM-DD
  inventory_usage_id?: string | null;
};

export default function PlantDetailsPage() {
  return (
    <RequireAuth>
      <PlantDetailsInner />
    </RequireAuth>
  );
}

function PlantDetailsInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const plantId = useMemo(
    () => (Array.isArray(params?.id) ? params.id[0] : params?.id),
    [params]
  );

  // Page tab
  const [tab, setTab] = useState<'details' | 'diary'>('details');

  // Plant state
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Edit fields
  const [name, setName] = useState('');
  const [start, setStart] = useState<string>('');
  const [stage, setStage] = useState<string>('seedling');
  const [lineage, setLineage] = useState<string>('');
  const [breeder, setBreeder] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [harvestedAt, setHarvestedAt] = useState<string>('');
  const [yieldBud, setYieldBud] = useState<string>('');
  const [yieldTrim, setYieldTrim] = useState<string>('');
  const [harvestErr, setHarvestErr] = useState<string | null>(null);
  const [harvestMsg, setHarvestMsg] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);

  // Diary state
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dDate, setDDate] = useState<string>(''); // optional date; leave blank to use created_at
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!plantId) return;

    async function run() {
      setLoading(true);
      setErr(null);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setErr(uErr?.message ?? 'Not signed in');
        setLoading(false);
        return;
      }

      const baseQuery = supabase
        .from('plant_batches')
        .select('id, name, stage, start_date, strain, breeder, harvested_at, yield_bud, yield_trim, ctp_total')
        .eq('id', plantId)
        .maybeSingle();

      let data: Record<string, unknown> | null = null;
      const { data: baseData, error } = await baseQuery;

      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('breeder')) {
          const fallback = await supabase
            .from('plant_batches')
            .select('id, name, stage, start_date, strain, harvested_at, yield_bud, yield_trim, ctp_total')
            .eq('id', plantId)
            .maybeSingle();
          if (fallback.error) {
            setErr(fallback.error.message);
            setLoading(false);
            return;
          }
          data = (fallback.data as Record<string, unknown> | null) ?? null;
          if (data) {
            (data as any).breeder = null;
          }
        } else {
          setErr(error.message);
          setLoading(false);
          return;
        }
      } else {
        data = baseData as Record<string, unknown> | null;
      }

      if (!data) {
        setPlant(null);
        setLoading(false);
        return;
      }
      const raw = data as Record<string, unknown>;
      const p: Plant = {
        id: raw.id as string,
        name: (raw.name as string) ?? '',
        stage: (raw.stage as string | null) ?? null,
        start_date: (raw.start_date as string) ?? '',
        lineage: (raw.strain as string | null) ?? null,
        breeder: (raw.breeder as string | null) ?? null,
        harvested_at: (raw.harvested_at as string | null) ?? null,
        yield_bud: raw.yield_bud != null ? Number(raw.yield_bud) : null,
        yield_trim: raw.yield_trim != null ? Number(raw.yield_trim) : null,
        ctp_total: (raw.ctp_total as number | null) ?? null,
      };
      setPlant({
        ...p,
        ctp_total: normalizeCurrency(p.ctp_total),
      });
      setName(p.name ?? '');
      setStart(p.start_date ?? '');
      setStage(p.stage ?? 'seedling');
      setLineage(p.lineage ?? '');
      setBreeder(p.breeder ?? '');
      setHarvestedAt(p.harvested_at ? p.harvested_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setYieldBud(p.yield_bud != null ? String(p.yield_bud) : '');
      setYieldTrim(p.yield_trim != null ? String(p.yield_trim) : '');
      setHarvestErr(null);
      setHarvestMsg(null);
      setLoading(false);

      await loadDiary(p.id);
    }

    run();
  }, [plantId]);

  async function loadDiary(pid: string) {
    setDLoading(true);
    setDErr(null);
    const baseQuery = supabase
      .from('diary_entries')
      .select('id, note, created_at, entry_date, inventory_usage_id')
      .eq('batch_id', pid)
      .order('created_at', { ascending: false });

    const { data, error } = await baseQuery;

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('inventory_usage_id')) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('diary_entries')
          .select('id, note, created_at, entry_date')
          .eq('batch_id', pid)
          .order('created_at', { ascending: false });
        if (fallbackErr) {
          setDErr(fallbackErr.message);
          setDLoading(false);
          return;
        }
        setEntries((fallbackData ?? []) as DiaryEntry[]);
        setDLoading(false);
        return;
      }

      setDErr(error.message);
      setDLoading(false);
      return;
    }
    setEntries((data ?? []) as DiaryEntry[]);
    setDLoading(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!plant) return;
    setErr(null);
    setSavedMsg(null);

    if (!name.trim()) return setErr('Please enter a name.');
    if (!start) return setErr('Please choose a plant date.');

    setSaving(true);
    try {
      const { error } = await supabase
        .from('plant_batches')
        .update({
          name: name.trim(),
          start_date: start,
          stage,
          strain: lineage.trim() || null,
          breeder: breeder.trim() || null,
        })
        .eq('id', plant.id)
        .select('id')
        .maybeSingle();

      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('breeder')) {
          const fallback = await supabase
            .from('plant_batches')
            .update({
              name: name.trim(),
              start_date: start,
              stage,
              strain: lineage.trim() || null,
            })
            .eq('id', plant.id)
            .select('id')
            .maybeSingle();
          if (fallback.error) {
            setErr(fallback.error.message);
            setSaving(false);
            return;
          }
        } else {
          setErr(error.message);
          setSaving(false);
          return;
        }
      }

      setSavedMsg('Saved.');
      setPlant((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              start_date: start,
              stage,
              lineage: lineage.trim() || null,
              breeder: breeder.trim() || null,
            }
          : prev
      );
      setTimeout(() => setSavedMsg(null), 1200);
    } finally {
      setSaving(false);
    }
  }

  async function delPlant() {
    if (!plant) return;
    const ok = window.confirm('Delete this plant and all related records? This cannot be undone.');
    if (!ok) return;

    setErr(null);
    setSaving(true);
    try {
      const { error } = await supabase.from('plant_batches').delete().eq('id', plant.id);
      if (error) {
        setErr(error.message);
        return;
      }
      router.push('/plants');
    } finally {
      setSaving(false);
    }
  }

  async function harvestPlant(e: FormEvent) {
    e.preventDefault();
    if (!plant) return;
    setHarvestErr(null);
    setHarvestMsg(null);
    setHarvesting(true);
    try {
      const payload: Record<string, unknown> = {
        harvested_at: harvestedAt ? new Date(harvestedAt).toISOString() : new Date().toISOString(),
        yield_bud: yieldBud ? Number(yieldBud) : null,
        yield_trim: yieldTrim ? Number(yieldTrim) : null,
      };

      const { error } = await supabase
        .from('plant_batches')
        .update(payload)
        .eq('id', plant.id)
        .select('harvested_at,yield_bud,yield_trim')
        .maybeSingle();

      if (error) {
        setHarvestErr(error.message);
        return;
      }

      setPlant((prev) =>
        prev
          ? {
              ...prev,
              harvested_at: payload.harvested_at as string,
              yield_bud: payload.yield_bud as number | null,
              yield_trim: payload.yield_trim as number | null,
            }
          : prev
      );
      setHarvestedAt((payload.harvested_at as string).slice(0, 10));
      setHarvestMsg('Harvest saved.');
      setTimeout(() => setHarvestMsg(null), 1500);
    } finally {
      setHarvesting(false);
    }
  }

  async function revertHarvest() {
    if (!plant) return;
    const ok = window.confirm('Revert harvest for this plant?');
    if (!ok) return;
    setHarvestErr(null);
    setHarvestMsg(null);
    setHarvesting(true);
    try {
      const { error } = await supabase
        .from('plant_batches')
        .update({ harvested_at: null, yield_bud: null, yield_trim: null })
        .eq('id', plant.id)
        .select('id')
        .maybeSingle();

      if (error) {
        setHarvestErr(error.message);
        return;
      }

      setPlant((prev) =>
        prev
          ? {
              ...prev,
              harvested_at: null,
              yield_bud: null,
              yield_trim: null,
            }
          : prev
      );
      setHarvestedAt(new Date().toISOString().slice(0, 10));
      setYieldBud('');
      setYieldTrim('');
      setHarvestMsg('Harvest reverted.');
      setTimeout(() => setHarvestMsg(null), 1500);
    } finally {
      setHarvesting(false);
    }
  }

  async function addDiaryEntry(e: FormEvent) {
    e.preventDefault();
    if (!plant) return;
    if (!note.trim()) return;

    setAdding(true);
    setDErr(null);
    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setDErr(uErr?.message ?? 'Please sign in first.');
        setAdding(false);
        return;
      }

      const payload: {
        batch_id: string;
        user_id: string;
        note: string;
        entry_date: string | null;
      } = {
        batch_id: plant.id,
        user_id: u.user.id,
        note: note.trim(),
        entry_date: dDate || null,
      };

      const { error } = await supabase.from('diary_entries').insert(payload);
      if (error) {
        setDErr(error.message);
        setAdding(false);
        return;
      }

      setNote('');
      setDDate('');
      await loadDiary(plant.id);
    } finally {
      setAdding(false);
    }
  }

  async function deleteDiaryEntry(id: string) {
    if (!plant) return;
    const ok = window.confirm('Delete this diary entry?');
    if (!ok) return;

    setDErr(null);
    const { error } = await supabase.from('diary_entries').delete().eq('id', id);
    if (error) {
      setDErr(error.message);
      return;
    }
    await loadDiary(plant.id);

    const { data: updatedPlant, error: plantErr } = await supabase
      .from('plant_batches')
      .select('ctp_total')
      .eq('id', plant.id)
      .maybeSingle();
    if (!plantErr && updatedPlant) {
      setPlant((prev) =>
        prev
          ? { ...prev, ctp_total: normalizeCurrency(updatedPlant.ctp_total) }
          : prev
      );
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl p-6 text-gray-600">Loading…</main>;
  }

  if (!plant && !err) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Plant not found</h1>
        <p className="text-gray-700">This plant doesn’t exist or you don’t have access to it.</p>
        <Link href="/plants/">Go back to plants</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{plant?.name ?? 'Plant'}</h1>
          <p className="text-sm text-gray-600">ID: {plant?.id}</p>
          {plant && (
            <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Cost to Produce
              <span className="font-semibold">{formatCurrency(plant.ctp_total ?? 0)}</span>
            </p>
          )}
          {plant?.harvested_at && (
            <p className="text-xs text-gray-500 mt-1">Harvested on {plant.harvested_at.slice(0, 10)}</p>
          )}
        </div>
        <Link href="/plants/">Go back to plants</Link>
      </header>

      {/* Tabs */}
      <nav className="flex gap-3 border-b pb-2 text-sm">
        <button
          className={`pb-2 ${tab === 'details' ? 'border-b-2 border-black font-medium' : 'text-gray-600'}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          className={`pb-2 ${tab === 'diary' ? 'border-b-2 border-black font-medium' : 'text-gray-600'}`}
          onClick={() => setTab('diary')}
        >
          Diary
        </button>
      </nav>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {savedMsg && tab === 'details' && <p className="text-sm text-green-700">{savedMsg}</p>}

      {/* Details tab */}
      {tab === 'details' && plant && (
        <section className="rounded border p-4 space-y-3">
          <h2 className="text-lg font-semibold">Details</h2>

          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">Name</label>
              <input
                className="w-full rounded border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Blue Dream Batch A"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Plant Date</label>
              <input
                className="w-full rounded border p-2"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Growth Stage</label>
              <select
                className="w-full rounded border p-2"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                <option value="seedling">seedling</option>
                <option value="veg">veg</option>
                <option value="flower">flower</option>
                <option value="dry">dry</option>
                <option value="cure">cure</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm">Lineage (optional)</label>
              <input
                className="w-full rounded border p-2"
                value={lineage}
                onChange={(e) => setLineage(e.target.value)}
                placeholder="e.g., (OG Kush × GSC)"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Breeder (optional)</label>
              <input
                className="w-full rounded border p-2"
                value={breeder}
                onChange={(e) => setBreeder(e.target.value)}
                placeholder="e.g., Humboldt Seed Co."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={delPlant}
                className="rounded border px-3 py-2 text-red-700 border-red-600"
                disabled={saving}
              >
                Delete plant
              </button>
            </div>
          </form>

          <hr className="my-4" />

          {plant?.harvested_at ? (
            <div className="space-y-3">
              <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Harvested on {plant.harvested_at.slice(0, 10)}
                {plant.yield_bud != null ? ` • Bud yield: ${plant.yield_bud}` : ''}
                {plant.yield_trim != null ? ` • Trim yield: ${plant.yield_trim}` : ''}
              </div>
              {harvestMsg && <p className="text-sm text-emerald-600">{harvestMsg}</p>}
              {harvestErr && <p className="text-sm text-red-600">{harvestErr}</p>}
              <button
                type="button"
                onClick={revertHarvest}
                className="rounded border px-3 py-2 text-sm text-blue-700 border-blue-600"
                disabled={harvesting}
              >
                {harvesting ? 'Reverting…' : 'Revert harvest'}
              </button>
            </div>
          ) : (
            <form onSubmit={harvestPlant} className="space-y-3">
              <h3 className="text-sm font-semibold">Harvest</h3>
              <div>
                <label className="mb-1 block text-sm">Harvest date</label>
                <input
                  className="w-full rounded border p-2"
                  type="date"
                  value={harvestedAt}
                  onChange={(e) => setHarvestedAt(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Bud yield (optional)</label>
                <input
                  className="w-full rounded border p-2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={yieldBud}
                  onChange={(e) => setYieldBud(e.target.value)}
                  placeholder="e.g., 420"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm">Trim yield (optional)</label>
                <input
                  className="w-full rounded border p-2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={yieldTrim}
                  onChange={(e) => setYieldTrim(e.target.value)}
                  placeholder="e.g., 60"
                />
              </div>
              {harvestErr && <p className="text-sm text-red-600">{harvestErr}</p>}
              {harvestMsg && <p className="text-sm text-emerald-600">{harvestMsg}</p>}
              <button
                type="submit"
                className="rounded border border-emerald-600 px-3 py-2 text-sm text-emerald-700"
                disabled={harvesting}
              >
                {harvesting ? 'Saving…' : 'Harvest plant'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Diary tab */}
      {tab === 'diary' && plant && (
        <section className="rounded border p-4 space-y-4">
          <h2 className="text-lg font-semibold">Diary</h2>

          {dErr && <p className="text-sm text-red-600">{dErr}</p>}

          {/* Add entry */}
          <form onSubmit={addDiaryEntry} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm">Notes</label>
              <textarea
                className="w-full rounded border p-2"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened today? Watering, feeding, training, issues, observations…"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">
                Entry date (optional — leave blank to use today)
              </label>
              <input
                className="w-full rounded border p-2"
                type="date"
                value={dDate}
                onChange={(e) => setDDate(e.target.value)}
              />
            </div>

            <button
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
              disabled={adding}
            >
              {adding ? 'Adding…' : 'Add entry'}
            </button>
          </form>

          {/* List entries */}
          <div className="pt-2">
            {dLoading ? (
              <p className="text-gray-600">Loading entries…</p>
            ) : entries.length === 0 ? (
              <p className="text-gray-700">No diary entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {displayEntryDate(e.entry_date, e.created_at)}
                      </div>
                      <button
                        onClick={() => deleteDiaryEntry(e.id)}
                        className="text-sm text-red-700 underline"
                      >
                        Delete
                      </button>
                    </div>
                    {e.note && <p className="mt-2 whitespace-pre-wrap">{e.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

/* ---------- helpers ---------- */

function displayEntryDate(entryDate: string | null, createdAt: string) {
  // Prefer explicit entry_date (YYYY-MM-DD). Fallback to date part of created_at.
  if (entryDate) return `Date: ${entryDate}`;
  try {
    const d = new Date(createdAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `Date: ${yyyy}-${mm}-${dd}`;
  } catch {
    return `Date: ${entryDate ?? createdAt}`;
  }
}

function normalizeCurrency(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value: number | string | null | undefined): string {
  const amount = normalizeCurrency(value);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
