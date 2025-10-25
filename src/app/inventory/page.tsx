'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  unit_cost: number | null;
  qty: number | null;
  created_at: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setErr(null);

      // ✅ Check if the user is signed in first
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/signin');
        return;
      }

      // ✅ Now fetch data safely
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id,name,category,unit,unit_cost,qty,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!isMounted) return;
      if (error) setErr(error.message);
      else setItems(data ?? []);
      setLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const fmtMoney = (n: number | null) => (n ?? 0).toFixed(2);
  const rowTotal = (i: InventoryItem) =>
    fmtMoney((i.unit_cost ?? 0) * (i.qty ?? 0));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Link
          href="/inventory/new"
          className="rounded bg-black px-3 py-2 text-white"
        >
          Add item
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {!loading && !err && items.length === 0 && (
        <p className="text-gray-600">
          No items yet. Click “Add item” to create one.
        </p>
      )}

      {!loading && !err && items.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Name</th>
              <th className="py-2">Category</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2">Unit cost</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/inventory/${i.id}`}>
                    {i.name}
                  </Link>
                </td>
                <td className="py-2">{i.category ?? '—'}</td>
                <td className="py-2">{i.qty ?? 0}</td>
                <td className="py-2">{i.unit ?? '—'}</td>
                <td className="py-2">{fmtMoney(i.unit_cost)}</td>
                <td className="py-2">{rowTotal(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}