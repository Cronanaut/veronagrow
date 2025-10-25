// src/utils/supabase.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Lightweight client factory for server/components where you only
 * need the public anon key + URL. RLS still applies per user session
 * when used on the client; on the server this is a generic anon client.
 */
export function createClient() {
  if (!url || !anonKey) {
    throw new Error('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createSupabaseClient(url, anonKey);
}