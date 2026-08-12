import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client using the public anon key. Only used for realtime
 * subscriptions on the leaderboard. Returns null if env vars are absent so the
 * caller can fall back to polling.
 */
export function getBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  cached = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return cached;
}
