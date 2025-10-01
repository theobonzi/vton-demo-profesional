import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase env variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env');
      throw new Error('Configuration Supabase manquante');
    }
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
