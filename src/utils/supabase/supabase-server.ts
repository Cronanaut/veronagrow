// Proxy to the canonical server helper.
// If you add a top-level file later (src/utils/supabase-server.ts),
// you can keep this re-export so old imports continue to work.

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieRecord = { name: string; value: string; options: CookieOptions };

export default function createServerSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Cast to any to avoid Next’s typing differences across versions.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getAll: () => (cookies() as any).getAll(),
        setAll: (list: CookieRecord[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const store: any = cookies();
          for (const { name, value, options } of list) {
            try {
              store.set(name, value, options);
            } catch {
              // ignore if headers already sent (dev)
            }
          }
        },
      },
    }
  );
}