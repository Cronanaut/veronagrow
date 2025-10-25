'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type UnitSystem = 'metric' | 'imperial';
type TempUnit = 'C' | 'F';

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Costs
  const [waterCost, setWaterCost] = useState<number>(0);
  const [electricityCost, setElectricityCost] = useState<number>(0);

  // Preferences
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [temperatureUnit, setTemperatureUnit] = useState<TempUnit>('C');

  const load = useCallback(async () => {
    setErr(null);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setErr(userErr.message);
      setLoading(false);
      return;
    }
    const user = userRes.user;
    if (!user) {
      router.push('/signin');
      return;
    }

    const { data: p, error: pErr } = await supabase
      .from('profiles')
      .select(
        'water_cost_per_unit, electricity_cost_per_kwh, unit_system, temperature_unit'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (pErr) setErr(pErr.message);
    else {
      setWaterCost(p?.water_cost_per_unit ?? 0);
      setElectricityCost(p?.electricity_cost_per_kwh ?? 0);
      setUnitSystem((p?.unit_system as UnitSystem) ?? 'metric');
      setTemperatureUnit((p?.temperature_unit as TempUnit) ?? 'C');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session?.user) router.push('/signin');
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [load, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid) {
        router.push('/signin');
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: uid,
            water_cost_per_unit: waterCost,
            electricity_cost_per_kwh: electricityCost,
            unit_system: unitSystem,
            temperature_unit: temperatureUnit,
          },
          { onConflict: 'id' }
        );

      if (error) setErr(error.message);
      else setOk('Settings saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Preferences */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Preferences</h2>

        {/* Unit system */}
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Measurement system</p>
          <div className="inline-flex overflow-hidden rounded border">
            <button
              type="button"
              className={`px-3 py-2 text-sm ${
                unitSystem === 'metric' ? 'bg-black text-white' : 'bg-white'
              }`}
              aria-pressed={unitSystem === 'metric'}
              onClick={() => setUnitSystem('metric')}
            >
              Metric
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm ${
                unitSystem === 'imperial' ? 'bg-black text-white' : 'bg-white'
              }`}
              aria-pressed={unitSystem === 'imperial'}
              onClick={() => setUnitSystem('imperial')}
            >
              Imperial
            </button>
          </div>
        </div>

        {/* Temperature */}
        <div className="mb-2">
          <p className="text-sm font-medium mb-2">Temperature unit</p>
          <div className="inline-flex overflow-hidden rounded border">
            <button
              type="button"
              className={`px-3 py-2 text-sm ${
                temperatureUnit === 'C' ? 'bg-black text-white' : 'bg-white'
              }`}
              aria-pressed={temperatureUnit === 'C'}
              onClick={() => setTemperatureUnit('C')}
            >
              °C
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm ${
                temperatureUnit === 'F' ? 'bg-black text-white' : 'bg-white'
              }`}
              aria-pressed={temperatureUnit === 'F'}
              onClick={() => setTemperatureUnit('F')}
            >
              °F
            </button>
          </div>
        </div>
      </section>

      {/* Cost Settings */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Cost Settings</h2>

        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="text-sm">Water cost per unit (e.g. $/gal)</span>
            <input
              className="mt-1 w-full rounded border p-2"
              type="number"
              step="0.0001"
              min={0}
              value={Number.isFinite(waterCost) ? waterCost : 0}
              onChange={(e) =>
                setWaterCost(e.target.value === '' ? 0 : parseFloat(e.target.value))
              }
            />
          </label>

          <label className="block">
            <span className="text-sm">Electricity cost per kWh ($)</span>
            <input
              className="mt-1 w-full rounded border p-2"
              type="number"
              step="0.0001"
              min={0}
              value={Number.isFinite(electricityCost) ? electricityCost : 0}
              onChange={(e) =>
                setElectricityCost(e.target.value === '' ? 0 : parseFloat(e.target.value))
              }
            />
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}
          {ok && <p className="text-sm text-green-700">{ok}</p>}

          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>
    </main>
  );
}