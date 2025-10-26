// Shim so imports like "@/utils/supabase/server" keep working in your codebase
import supabase from './supabase-client';

export default supabase;
export const createClient = () => supabase;
export const createServerClient = () => supabase;