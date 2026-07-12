import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function isConfigured(url: string | undefined, key: string | undefined): boolean {
  return !!url && !!key && /^https?:\/\//.test(url);
}

/**
 * Supabase client for the cloud backup/restore feature, or `null` when
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not filled in
 * (e.g. a fresh checkout with only the placeholder .env). Every caller must
 * treat `null` as "cloud sync not configured" and no-op instead of throwing
 * — this app runs fully offline by design, cloud sync is a bonus feature.
 */
export const supabase: SupabaseClient | null = isConfigured(supabaseUrl, supabaseAnonKey)
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isSupabaseConfigured = supabase !== null;
