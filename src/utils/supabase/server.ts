// src/utils/supabase/server.ts
// Single, stable server-side client.
// Safe to import in server pages & server actions.
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function createServerSupabase(): SupabaseClient {
  // Some Next types mark cookies() as Promise in older versions.
  // Casting to any avoids TS noise while working correctly at runtime.
  const store = cookies() as any;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            try {
              store.set(name, value, options as CookieOptions);
            } catch {
              // Ignore "headers already sent" in dev hot refresh.
            }
          }
        },
      },
    }
  );
}