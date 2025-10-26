// Shim so imports like "@/utils/supabase-server" keep working
import supabase from './supabase/supabase-client';

export default supabase;
export const createClient = () => supabase;
export const createServerClient = () => supabase;