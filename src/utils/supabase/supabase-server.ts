// Proxy to the canonical server helper.
// Next 15 requires awaiting cookies() before using it.

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieRecord = { name: string; value: string; options: CookieOptions };

export default function createServerSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Next.js 15+ wants these to await cookies() before use
        getAll: async () => (await cookies()).getAll(),
        setAll: async (list: CookieRecord[]) => {
          const store = await cookies();
          for (const { name, value, options } of list) {
            try {
              store.set(name, value, options);
            } catch {
              // ignore if headers already sent in dev fast-refresh
            }
          }
        },
      },
    }
  );
}