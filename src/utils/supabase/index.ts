// src/utils/supabase/index.ts
// Compatibility layer so existing imports keep working.
// - default export: client (for client components)
// - named { supabase }: same client
// - named { createClient }: returns the same client (legacy callers)
// If you need server-side usage, import from '@/utils/supabase/server'.
import client from './client';

export default client;
export { default as supabase } from './client';
export const createClient = () => client;