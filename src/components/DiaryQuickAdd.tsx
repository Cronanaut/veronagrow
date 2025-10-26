'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';

type Props = { plantBatchId: string; onAdded?: () => void; };
type EntryType = 'note' | 'stage_change' | 'inventory' | 'cost' | 'labor' | 'env';

export default function DiaryQuickAdd({ plantBatchId, onAdded }: Props) {
  const [entryType, setEntryType] = useState<EntryType>('note');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!content.trim()) {
      setErr('Please add some details.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('diary_entries')
        .insert({
          plant_batch_id: plantBatchId,
          entry_type: entryType,
          content: content.trim(),
        });
      if (error) setErr(error.message);
      else {
        setContent('');
        setEntryType('note');
        onAdded?.();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded p-4 mb-6">
      <h3 className="font-semibold mb-3">Quick diary entry</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm mb-1">Type</label>
          <select
            className="border rounded px-2 py-1 w-full"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
          >
            <option value="note">Note</option>
            <option value="stage_change">Stage change</option>
            <option value="inventory">Inventory usage</option>
            <option value="cost">Cost</option>
            <option value="labor">Labor</option>
            <option value="env">Environment</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1">Details</label>
          <textarea
            className="border rounded px-2 py-1 w-full min-h-[80px]"
            placeholder="What happened? e.g., watered 2L, switched to flower, added 5ml Cal-Mag, etc."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      <div className="mt-3">
        <button className="px-3 py-2 rounded bg-black text-white disabled:opacity-60" disabled={saving}>
          {saving ? 'Saving…' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}