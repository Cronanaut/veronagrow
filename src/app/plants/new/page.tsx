'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';

export default function NewPlantPage() {
  return (
    <RequireAuth>
      <NewPlantInner />
    </RequireAuth>
  );
}

function NewPlantInner() {
  const [name, setName] = useState('');
  const [start, setStart] = useState<string>('');
  const [stage, setStage] = useState('seedling'); // seedling | veg | flower | dry | cure
  const [lineage, setLineage] = useState('');
  const [breeder, setBreeder] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) {
      setErr('Please enter a name.');
      return;
    }
    if (!start) {
      setErr('Please choose a plant date.');
      return;
    }

    setSaving(true);
    try {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setErr(uErr?.message ?? 'Please sign in first.');
        setSaving(false);
        return;
      }

      const payload = {
        user_id: u.user.id,
        name: name.trim(),
        start_date: start, // YYYY-MM-DD
        stage,
        strain: lineage.trim() || null,
        breeder: breeder.trim() || null,
      };

      const { error } = await supabase.from('plant_batches').insert(payload);
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('breeder')) {
          const fallbackPayload = {
            user_id: payload.user_id,
            name: payload.name,
            start_date: payload.start_date,
            stage: payload.stage,
            strain: payload.strain,
          };
          const { error: fallbackErr } = await supabase
            .from('plant_batches')
            .insert(fallbackPayload);
          if (fallbackErr) {
            setErr(fallbackErr.message);
            setSaving(false);
            return;
          }
        } else {
          setErr(error.message);
          setSaving(false);
          return;
        }
      }

      window.location.href = '/plants';
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-bold">Add Plant</h1>

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

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href="/plants">Back to plants</Link>
        </div>
      </form>
    </main>
  );
}
