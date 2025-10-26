// src/utils/supabase/supabase-client.ts
'use client';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (for Client Components)
export const supabase: SupabaseClient = createClient(url, anon);

// Keep default export, so both of these work:
//
//   import { supabase } from '@/utils/supabase'
//   import supabase from '@/utils/supabase'
//
export default supabase;