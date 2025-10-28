'use client';

// src/app/(app)/inventory/page.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';
import { ensureWaterItem } from '@/utils/ensure-water-item';

type ItemRow = {
  id: string;
  name: string | null;
  unit: string | null;
  unit_cost: number | null;
  qty: number | null;
  category: string | null;
  is_persistent: boolean | null;
};

function formatQty(qty: number | null, isPersistent?: boolean | null): string {
  if (isPersistent) return '∞';
  if (qty == null) return '0';
  const num = Number(qty);
  if (!Number.isFinite(num)) return '∞';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function InventoryListPage() {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        // Ensure there’s a user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          // RequireAuth will actually redirect; we just early-return so we don’t flash junk
          setLoading(false);
          return;
        }

        await ensureWaterItem(userData.user.id);

        const { data, error } = await supabase
          .from('inventory_items')
          .select('id,name,unit,unit_cost,qty,category,is_persistent')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!isMounted) return;
        setItems(data ?? []);
      } catch (e) {
        console.error('Failed to load inventory:', e);
        if (!isMounted) return;
        setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Auth guard */}
      <RequireAuth />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Link
          href="/inventory/new"
          className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
        >
          New Item
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : !items || items.length === 0 ? (
        <div className="rounded-2xl border p-6 text-center text-gray-600">
          No items yet.{' '}
          <Link href="/inventory/new" className="underline">
            Create your first item
          </Link>
          .
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Qty</th>
                <th className="px-4 py-2 text-left">Unit</th>
                <th className="px-4 py-2 text-left">Price/Unit</th>
                <th className="px-4 py-2 text-left">Category</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link href={`/inventory/${it.id}`} className="underline">
                      {it.name || '(untitled)'}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatQty(it.qty, it.is_persistent)}</td>
                  <td className="px-4 py-2">{it.unit ?? ''}</td>
                  <td className="px-4 py-2">
                    {it.unit_cost != null ? `$${it.unit_cost.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-4 py-2">{it.category ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
