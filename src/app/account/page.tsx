'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
type Profile = {
  username: string | null;
};

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile>({ username: '' });

  const loadProfile = useCallback(async () => {
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
    setUserEmail(user.email ?? '');

    // ✅ Only fetch username here (cost fields are now on /settings)
    const { data: p, error: pErr } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (pErr) setErr(pErr.message);
    else setProfile({ username: p?.username ?? '' });

    setLoading(false);
  }, [router]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await loadProfile();
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
  }, [loadProfile, router]);

  async function saveProfile(e: React.FormEvent) {
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

      // ✅ Only upsert username (no cost fields here)
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: uid,
            username: profile.username ?? null,
          },
          { onConflict: 'id' }
        );

      if (error) {
        setErr(error.message);
      } else {
        setOk('Profile saved.');
        await loadProfile(); // refresh immediately
      }
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setErr(null);
    setOk(null);
    await supabase.auth.signOut();
    router.push('/signin');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input[type="password"]') as HTMLInputElement | null;
    const newPassword = input?.value ?? '';

    if (newPassword.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setErr(error.message);
    else {
      setOk('Password updated.');
      if (input) input.value = '';
    }
  }

  async function changeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const input = e.currentTarget.querySelector('input[type="email"]') as HTMLInputElement | null;
    const newEmail = input?.value.trim() ?? '';
    if (!newEmail || !newEmail.includes('@')) {
      setErr('Enter a valid email.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) setErr(error.message);
    else {
      setOk('Check your new email to confirm the change.');
      if (input) input.value = '';
    }
  }

  async function sendPasswordReset() {
    setErr(null);
    setOk(null);
    const { data: ures } = await supabase.auth.getUser();
    const email = ures.user?.email;
    if (!email) {
      setErr('No email found on your account.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/auth/reset',
    });
    if (error) setErr(error.message);
    else setOk('Password reset email sent. (Mailpit http://localhost:54324 in local dev).');
  }

  if (loading) return <main className="max-w-xl mx-auto p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Account</h1>

      {/* Basics */}
      <section className="space-y-2">
        <p><span className="font-semibold">Username:</span> {profile.username || '—'}</p>
        <p><span className="font-semibold">Email:</span> {userEmail || '—'}</p>
      </section>

      {/* Profile */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          <label className="block">
            <span className="text-sm">Username</span>
            <input
              className="mt-1 w-full rounded border p-2"
              value={profile.username ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              placeholder="your-name"
            />
          </label>

          {err && !err.startsWith('Password') && (
            <p className="text-sm text-red-600">{err}</p>
          )}
          {ok && <p className="text-sm text-green-700">{ok}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Security */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Security</h2>

        <form onSubmit={changePassword} className="space-y-3">
          <label className="block">
            <span className="text-sm">New password</span>
            <input
              className="mt-1 w-full rounded border p-2"
              type="password"
              minLength={8}
              placeholder="••••••••"
            />
          </label>
          {err === 'Password must be at least 8 characters.' && (
            <p className="text-sm text-red-600">{err}</p>
          )}
          <button className="rounded bg-black px-3 py-2 text-white" type="submit">
            Update password
          </button>
        </form>

        <form onSubmit={changeEmail} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-sm">New email</span>
            <input
              className="mt-1 w-full rounded border p-2"
              type="email"
              placeholder="new-email@example.com"
            />
          </label>
          <p className="text-xs text-gray-500">
            We’ll send a confirmation link to your new email. The change completes after you click it.
          </p>
          <div className="flex items-center gap-3">
            <button className="rounded bg-black px-3 py-2 text-white" type="submit">
              Update email
            </button>
            <button type="button" onClick={sendPasswordReset} className="rounded border px-3 py-2">
              Reset password
            </button>
          </div>
        </form>
      </section>

      {/* Session */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Session</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={signOut} className="rounded border px-3 py-2">
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
