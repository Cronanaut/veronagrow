// Shim so imports like "@/utils/supabase/supabase-server" keep working
import supabase from './supabase-client';

export default supabase;
export const createClient = () => supabase;
export const createServerClient = () => supabase;