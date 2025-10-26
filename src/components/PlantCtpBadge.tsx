'use client';

import { useEffect, useState } from 'react';
import supabase from '@/utils/supabase';

export default function PlantCtpBadge({ plantId }: { plantId: string }) {
  const [ctp, setCtp] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('plant_batches')
        .select('ctp_total')
        .eq('id', plantId)
        .single();
      if (!alive) return;
      if (!error) setCtp((data?.ctp_total as number) ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, [plantId]);

  return (
    <div className="rounded-md border px-3 py-1 text-sm">
      <span className="text-neutral-500 mr-2">CTP</span>
      <span className="font-medium">{ctp != null ? `$${Number(ctp).toFixed(2)}` : '—'}</span>
    </div>
  );
}