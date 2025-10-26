'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

function getHashParams() {
  // Supabase sends tokens in the URL hash after you click the email link
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return {
    access_token: params.get('access_token') ?? '',
    refresh_token: params.get('refresh_token') ?? '',
    type: params.get('type') ?? '',
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'parsing' | 'auth' | 'ready' | 'done' | 'error'>('parsing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { access_token, refresh_token, type } = useMemo(getHashParams, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  // 1) When we land here from the email link, set the session with tokens from the hash
  useEffect(() => {
    async function run() {
      try {
        setErrorMsg(null);

        if (!access_token || !refresh_token || type !== 'recovery') {
          setStage('error');
          setErrorMsg('Invalid or missing recovery tokens. Open the reset link from your email again.');
          return;
        }

        setStage('auth');
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          setStage('error');
          setErrorMsg(error.message);
          return;
        }

        // Now we’re authenticated as the user; show the change-password form
        setStage('ready');
      } catch (e) {
        setStage('error');
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }

      setStage('done');
      // Small pause then send them to sign-in
      setTimeout(() => router.push('/signin'), 1200);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Reset your password</h1>

      {stage === 'parsing' || stage === 'auth' ? (
        <p>Loading…</p>
      ) : stage === 'error' ? (
        <>
          <p className="text-red-600 mb-3">{errorMsg}</p>
          <p className="text-sm text-gray-600">
            If this keeps happening, request a new reset link from the sign-in page.
          </p>
        </>
      ) : stage === 'done' ? (
        <p className="text-green-700">Password updated. Redirecting to sign in…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm">New password</span>
            <input
              className="border w-full p-2 rounded mt-1"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          <label className="block">
            <span className="text-sm">Confirm new password</span>
            <input
              className="border w-full p-2 rounded mt-1"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

          <button
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </main>
  );
}