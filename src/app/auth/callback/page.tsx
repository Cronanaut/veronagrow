'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

export default function AuthCallback() {
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        // 1) Most Supabase magic links return tokens in the URL fragment (#...)
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : '';
        const fragParams = new URLSearchParams(hash);
        const access_token = fragParams.get('access_token');
        const refresh_token = fragParams.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          setStatus('ok');
          setMessage('Signed in successfully!');
          setTimeout(() => window.location.replace('/account'), 600);
          return;
        }

        // 2) Fallback: some flows send a `?code=...` in the URL (query params)
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) throw error;

        setStatus('ok');
        setMessage('Signed in via code exchange!');
        setTimeout(() => window.location.replace('/account'), 600);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown authentication error';
        setStatus('error');
        setMessage(msg);
      }
    })();
  }, []);

  return (
    <main className="max-w-sm mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Signing you in…</h1>
      <p
        className={
          status === 'error'
            ? 'text-red-600'
            : status === 'ok'
            ? 'text-green-600'
            : 'text-gray-500'
        }
      >
        {message || 'Please wait a moment.'}
      </p>
    </main>
  );
}