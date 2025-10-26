// src/utils/supabase.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

/**
 * Minimal cookie interface that matches what @supabase/ssr expects.
 * We don't rely on Next's internal types; this avoids 'any' while staying compatible.
 */
type MinimalCookie = { name: string; value: string };
interface MinimalCookies {
  getAll(): MinimalCookie[];
  set(name: string, value: string, options?: CookieOptions): void;
}

type CookieRecord = { name: string; value: string; options: CookieOptions };

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Call cookies() at use-time; it's synchronous in server components/actions.
        getAll: () => {
          const store = cookies() as unknown as MinimalCookies;
          return store.getAll();
        },
        setAll: (list: CookieRecord[]) => {
          const store = cookies() as unknown as MinimalCookies;
          for (const { name, value, options } of list) {
            try {
              store.set(name, value, options);
            } catch (err) {
              // Non-fatal in dev; avoids crashes if headers already sent
              console.warn('Failed to set cookie:', name, err);
            }
          }
        },
      },
    }
  );
}