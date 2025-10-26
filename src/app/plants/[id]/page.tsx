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
  strain: string | null;
};

type DiaryEntry = {
  id: string;
  note: string | null;
  created_at: string; // ISO timestamp
  entry_date: string | null; // optional YYYY-MM-DD
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
  const [strain, setStrain] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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

      const { data, error } = await supabase
        .from('plant_batches')
        .select('id, name, stage, start_date, strain')
        .eq('id', plantId)
        .maybeSingle();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setPlant(null);
        setLoading(false);
        return;
      }

      const p = data as Plant;
      setPlant(p);
      setName(p.name ?? '');
      setStart(p.start_date ?? '');
      setStage(p.stage ?? 'seedling');
      setStrain(p.strain ?? '');
      setLoading(false);

      await loadDiary(p.id);
    }

    run();
  }, [plantId]);

  async function loadDiary(pid: string) {
    setDLoading(true);
    setDErr(null);
    const { data, error } = await supabase
      .from('diary_entries')
      .select('id, note, created_at, entry_date')
      .eq('batch_id', pid)
      .order('created_at', { ascending: false });

    if (error) {
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
    if (!start) return setErr('Please choose a start date.');

    setSaving(true);
    try {
      const { error } = await supabase
        .from('plant_batches')
        .update({
          name: name.trim(),
          start_date: start,
          stage,
          strain: strain.trim() || null,
        })
        .eq('id', plant.id)
        .select('id')
        .maybeSingle();

      if (error) return setErr(error.message);

      setSavedMsg('Saved.');
      setPlant({
        id: plant.id,
        name: name.trim(),
        start_date: start,
        stage,
        strain: strain.trim() || null,
      });
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
    setEntries((prev) => prev.filter((x) => x.id !== id));
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
              <label className="mb-1 block text-sm">Start date</label>
              <input
                className="w-full rounded border p-2"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Stage</label>
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
              <label className="mb-1 block text-sm">Strain (optional)</label>
              <input
                className="w-full rounded border p-2"
                value={strain}
                onChange={(e) => setStrain(e.target.value)}
                placeholder="e.g., Blue Dream"
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