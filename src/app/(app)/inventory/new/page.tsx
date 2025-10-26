'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/utils/supabase';

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [userReady, setUserReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setUserReady(true);
      if (!uid) router.push('/signin');
    });
    return () => { mounted = false; };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        name: name.trim(),
        category: category.trim() || null,
        unit: unit.trim() || null,
        qty: 0,            // start at 0 — will grow via Lots & Usages
        unit_cost: null,   // derived from latest lot, not entered here
      })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.push(`/inventory/${data!.id}`);
  }

  if (!userReady) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Inventory Item</h1>
        <Link href="/inventory" className="underline">Back to inventory</Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 md:col-span-2">
            <div className="text-sm text-neutral-400">Name *</div>
            <input
              required
              className="w-full rounded-md border bg-transparent p-2"
              placeholder="e.g., Coco, Dirt, Jacks Part A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-neutral-400">Category</div>
            <input
              className="w-full rounded-md border bg-transparent p-2"
              placeholder="e.g., media, nutrient, pesticide"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-neutral-400">Unit</div>
            <input
              className="w-full rounded-md border bg-transparent p-2"
              placeholder="e.g., lbs, kg, gal"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md border px-4 py-2"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <Link href="/inventory" className="rounded-md border px-4 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}