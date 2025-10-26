'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/utils/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type Props = { children?: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) router.replace('/signin');
      setChecked(true);
    });

    // React to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session) router.replace('/signin');
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  if (!checked) return null;
  return <>{children ?? null}</>;
}