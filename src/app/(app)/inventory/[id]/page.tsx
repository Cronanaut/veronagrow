'use client';

// src/app/(app)/inventory/[id]/page.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';

type ItemRow = {
  id: string;
  name: string | null;
  unit: string | null;
  unit_cost: number | null;
  qty: number | null;
  category: string | null;
};

export default function InventoryItemPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!id) return;

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('inventory_items')
          .select('id,name,unit,unit_cost,qty,category')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!isMounted) return;
        setItem(data);
      } catch (e) {
        console.error('Failed to load item:', e);
        if (!isMounted) return;
        setItem(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <RequireAuth />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {item?.name || 'Inventory item'}
        </h1>
        <Link href="/inventory" className="underline">
          Back to inventory
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : !item ? (
        <div className="rounded-2xl border p-6 text-center text-gray-600">
          Item not found.
        </div>
      ) : (
        <div className="rounded-2xl border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Quantity</div>
              <div className="font-medium">{item.qty ?? 0}</div>
            </div>
            <div>
              <div className="text-gray-500">Unit</div>
              <div className="font-medium">{item.unit ?? '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">Price / Unit</div>
              <div className="font-medium">
                {item.unit_cost != null ? `$${item.unit_cost.toFixed(2)}` : '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Category</div>
              <div className="font-medium">{item.category ?? '-'}</div>
            </div>
          </div>

          {/* Placeholder for future edit / lots / usage UI */}
          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            Editing, lots, and usage history will go here next.
          </div>
        </div>
      )}
    </div>
  );
}