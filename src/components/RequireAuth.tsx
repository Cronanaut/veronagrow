'use client';

import { useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type Props = { children: ReactNode; redirectTo?: string };

export default function RequireAuth({ children, redirectTo = '/signin' }: Props) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'nope'>('checking');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) setStatus('nope');
      else setStatus('authed');
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) setStatus('authed');
      else setStatus('nope');
    });

    return () => {
      sub.subscription.unsubscribe();
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <main className="max-w-sm mx-auto p-6 text-gray-500">Checking session…</main>;
  }
  if (status === 'nope') {
    if (typeof window !== 'undefined') window.location.replace(redirectTo);
    return null;
  }
  return <>{children}</>;
}