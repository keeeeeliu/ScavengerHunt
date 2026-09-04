import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gem coordinates: data/hunt.json holds the defaults; organizer adjustments
 * made in /admin/map are stored as overrides in a small JSON file in a private
 * `config` storage bucket. The bucket is separate from `photos` so a game
 * reset (which empties the photo bucket) never touches calibrated pins.
 */
export const CONFIG_BUCKET = "config";
const COORDS_PATH = "map-coords.json";

export type CoordOverrides = Record<string, { lat: number; lng: number }>;

export async function loadCoordOverrides(
  supabase: SupabaseClient
): Promise<CoordOverrides> {
  const { data, error } = await supabase.storage
    .from(CONFIG_BUCKET)
    .download(COORDS_PATH);
  if (error || !data) return {}; // bucket or file not created yet
  try {
    return JSON.parse(await data.text()) as CoordOverrides;
  } catch {
    return {};
  }
}

export async function saveCoordOverrides(
  supabase: SupabaseClient,
  overrides: CoordOverrides
): Promise<void> {
  // Create the bucket on first save; an "already exists" error is fine and
  // surfaces in the result object rather than as a rejection.
  await supabase.storage.createBucket(CONFIG_BUCKET, { public: false });

  const { error } = await supabase.storage
    .from(CONFIG_BUCKET)
    .upload(COORDS_PATH, JSON.stringify(overrides, null, 2), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    });
  if (error) throw error;
}
