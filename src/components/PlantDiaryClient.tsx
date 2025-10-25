'use client';

import { useState } from 'react';
import DiaryList from '@/components/DiaryList';
import DiaryQuickAdd from '@/components/DiaryQuickAdd';

type Props = {
  plantBatchId: string;
};

export default function PlantDiaryClient({ plantBatchId }: Props) {
  // When an entry is added, bump this key to force DiaryList to refetch.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div>
      <DiaryQuickAdd
        plantBatchId={plantBatchId}
        onAdded={() => setReloadKey((k) => k + 1)}
      />
      {/* The key forces a remount, which retriggers DiaryList's useEffect */}
      <DiaryList key={reloadKey} plantBatchId={plantBatchId} />
    </div>
  );
}