'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

type Mode = 'signin' | 'signup';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unexpected error';
  }
}

export default function AuthPage() {
  const router = useRouter();

  // UI mode: sign in vs sign up
  const [mode, setMode] = useState<Mode>('signin');

  // Form state (shared)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & errors
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Passkey scaffold (stable hydration)
  const [mounted, setMounted] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);

  // If already signed in, bounce to /plants
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) router.replace('/plants');
    })();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    setMounted(true);
    let supported = false;
    if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
      const pkc = (window as unknown as {
        PublicKeyCredential?: {
          isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
        };
      }).PublicKeyCredential;
      supported =
        !!pkc &&
        typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    }
    setWebauthnSupported(supported);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setErr(error.message);
        } else {
          router.push('/plants');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // after confirming via email, land on /plants
          options: { emailRedirectTo: `${location.origin}/plants` },
        });
        if (error) {
          setErr(error.message);
        } else if (data.session) {
          // some setups create a session immediately
          router.push('/plants');
        } else {
          setOk(
            'Account created. If confirmation is required, check Mailpit at http://localhost:54324 and click the link.'
          );
        }
      }
    } catch (caught) {
      setErr(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!email) {
      setErr('Enter your email above, then click “Send reset link.”');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/auth/reset',
    });
    if (error) setErr(error.message);
    else
      setOk(
        'Password reset email sent. Check your inbox (Mailpit at http://localhost:54324 for local).'
      );
  }

  function onPasskeySignIn(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    alert('Passkey sign-in coming soon.');
  }

  const passkeyLabel = mounted
    ? webauthnSupported
      ? 'Sign in with a passkey'
      : 'Passkeys not supported on this device'
    : 'Checking device…';
  const passkeyDisabled = mounted ? !webauthnSupported : true;
  const passkeyTitle = mounted
    ? webauthnSupported
      ? ''
      : 'Passkeys not supported in this browser'
    : '';

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h1>

      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded border overflow-hidden">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`px-3 py-2 text-sm ${
            mode === 'signin' ? 'bg-black text-white' : 'bg-white'
          }`}
          aria-pressed={mode === 'signin'}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`px-3 py-2 text-sm ${
            mode === 'signup' ? 'bg-black text-white' : 'bg-white'
          }`}
          aria-pressed={mode === 'signup'}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            className="border w-full p-2 rounded mt-1"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block relative">
          <span className="text-sm">Password</span>
          <input
            className="border w-full p-2 rounded mt-1 pr-10"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-8 text-sm text-gray-600"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </label>

        {err && <p className="text-red-600 text-sm">{err}</p>}
        {ok && <p className="text-green-700 text-sm">{ok}</p>}

        <button
          className="px-3 py-2 rounded bg-black text-white w-full disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading
            ? mode === 'signin'
              ? 'Signing in…'
              : 'Creating…'
            : mode === 'signin'
            ? 'Sign in'
            : 'Create account'}
        </button>
      </form>

      {/* Forgot password */}
      <form onSubmit={handleForgotPassword} className="pt-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          Forgot your password?
        </h2>
        <p className="text-xs text-gray-500">
          Enter your email above, then click to receive a password reset link.
        </p>
        <button
          type="submit"
          className="border rounded px-3 py-2 w-full"
          disabled={loading}
        >
          Send reset link
        </button>
      </form>

      {/* Passkey scaffold */}
      <div className="pt-4">
        <button
          onClick={onPasskeySignIn}
          disabled={passkeyDisabled}
          className="px-3 py-2 rounded border w-full disabled:opacity-50"
          title={passkeyTitle}
        >
          {passkeyLabel}
        </button>
      </div>
    </main>
  );
}