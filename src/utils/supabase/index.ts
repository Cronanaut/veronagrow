import supabase from './supabase-client';

export default supabase;                 // allows: import supabase from '@/utils/supabase'
export { supabase };                     // allows: import { supabase } from '@/utils/supabase'
export const createClient = () => supabase; // allows: import { createClient } from '@/utils/supabase'