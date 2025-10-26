'use client';

// src/app/(app)/inventory/new/page.tsx
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import RequireAuth from '@/components/RequireAuth';

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const qty = Number(String(form.get('qty') ?? '0'));
    const unit = String(form.get('unit') ?? '').trim();
    const unit_cost = Number(String(form.get('unit_cost') ?? '0'));
    const category = String(form.get('category') ?? '').trim() || null;

    try {
      // Must be logged in for RLS
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push('/signin');
        return;
      }

      const { error } = await supabase.from('inventory_items').insert({
        name,
        qty,
        unit,
        unit_cost,
        category,
        user_id: userData.user.id,
      });

      if (error) throw error;

      // Go back to list
      router.push('/inventory');
    } catch (e: unknown) {
      // ESLint-friendly error handling
      let message = 'Failed to create item';
      if (e instanceof Error) {
        message = e.message;
      } else {
        try {
          message = String(e);
        } catch {
          // keep default
        }
      }
      console.error(e);
      setErr(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <RequireAuth />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Inventory Item</h1>
        <Link href="/inventory" className="text-sm underline">
          Back to inventory
        </Link>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border p-5 space-y-5">
        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Name *</span>
            <input
              required
              name="name"
              placeholder="e.g., Coco, Dirt, Jacks Part A"
              className="rounded-lg border px-3 py-2"
              defaultValue=""
            />
          </label>

          {/* Category */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Category</span>
            <input
              name="category"
              placeholder="e.g., media, nutrient, pesticide"
              className="rounded-lg border px-3 py-2"
              defaultValue=""
            />
          </label>

          {/* Quantity */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Quantity</span>
            <input
              name="qty"
              type="number"
              step="0.01"
              placeholder="0"
              className="rounded-lg border px-3 py-2"
              defaultValue={0}
            />
          </label>

          {/* Unit */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Unit</span>
            <input
              name="unit"
              placeholder="e.g., lbs, kg, gal"
              className="rounded-lg border px-3 py-2"
              defaultValue=""
            />
          </label>

          {/* Unit Cost */}
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium">Price per Unit</span>
            <input
              name="unit_cost"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="rounded-lg border px-3 py-2"
              defaultValue={0}
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <Link
            href="/inventory"
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}