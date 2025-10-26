'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

type Props = { plantBatchId: string };

type DiaryEntry = {
  id: string;
  entry_date: string;
  entry_type: string;
  content: string | null;
};

export default function DiaryList({ plantBatchId }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('id, entry_date, entry_type, content')
        .eq('plant_batch_id', plantBatchId)
        .order('entry_date', { ascending: false })
        .limit(50);
      if (!cancelled) {
        if (error) setErr(error.message);
        else setEntries(data ?? []);
      }
    })();
    return () => { cancelled = true; };
  }, [plantBatchId]);

  if (err) return <p className="text-red-600">Error: {err}</p>;
  if (!entries.length) return <p className="text-sm text-gray-600">No entries yet.</p>;

  return (
    <ul className="space-y-2">
      {entries.map(e => (
        <li key={e.id} className="border rounded p-3">
          <div className="text-xs text-gray-500">{e.entry_date} • {e.entry_type}</div>
          {e.content && <div className="mt-1">{e.content}</div>}
        </li>
      ))}
    </ul>
  );
}