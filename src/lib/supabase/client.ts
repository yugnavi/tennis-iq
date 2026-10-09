/**
 * Browser Supabase client. Uses ONLY the anon/publishable key; all privileged
 * logic lives in Postgres RPCs guarded by RLS + grants (see supabase/migrations).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseConfig = { url: string; anonKey: string };

type EnvLike = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string | undefined>>;

/** Returns null when the env vars are missing or obviously placeholder values. */
export function readSupabaseConfig(env: EnvLike = import.meta.env as EnvLike): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (url.includes('your-project-ref') || anonKey.startsWith('your-')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true, // restores the anonymous identity after a refresh
      autoRefreshToken: true,
      detectSessionInUrl: true, // completes the Google OAuth redirect (?code=…)
      flowType: 'pkce',
      storageKey: 'tennis-iq-auth',
    },
  });
}
