// src/utils/supabase/index.ts
// Compatibility layer so existing imports keep working.
// - default export: client (for client components)
// - named { supabase }: same client
// - named { createClient }: returns the same client (legacy callers)
// If you need server-side usage, import from '@/utils/supabase/supabase-server'.
import client from './supabase-client';

export default client;
export { default as supabase } from './supabase-client';
export const createClient = () => client;