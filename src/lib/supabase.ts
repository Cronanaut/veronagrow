// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Log once on the client to verify which backend we're hitting.
if (typeof window !== 'undefined') {
  // You'll see this in the browser DevTools console.
  console.log('[VeronaGrow] SUPABASE_URL =', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);