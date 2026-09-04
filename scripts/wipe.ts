/**
 * DESTRUCTIVE: wipes all event data for a fresh start.
 *  - deletes every photo in the `photos` storage bucket
 *  - deletes all rows in `submissions`
 *  - deletes all rows in `teams`
 * Content tables (`routes`, `gems`) are left alone; re-run `npm run seed` after
 * this to reload teams (and upsert routes/gems).
 *
 * Usage: npm run wipe
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const PHOTOS_BUCKET = "photos";

async function emptyBucket(supabase: SupabaseClient, prefix = ""): Promise<number> {
  const { data: entries, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw error;
  if (!entries || entries.length === 0) return 0;

  let removed = 0;
  const files: string[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Folders have no `id`; recurse into them.
    if (entry.id === null) {
      removed += await emptyBucket(supabase, path);
    } else {
      files.push(path);
    }
  }
  if (files.length) {
    const { error: rmErr } = await supabase.storage.from(PHOTOS_BUCKET).remove(files);
    if (rmErr) throw rmErr;
    removed += files.length;
  }
  return removed;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const photos = await emptyBucket(supabase);
  console.log(`Deleted ${photos} photo(s) from storage.`);

  const { error: subErr } = await supabase.from("submissions").delete().gte("id", 0);
  if (subErr) throw subErr;
  console.log("Deleted all submissions.");

  const { error: teamErr } = await supabase.from("teams").delete().gte("id", 0);
  if (teamErr) throw teamErr;
  console.log("Deleted all teams.");

  console.log("Wipe complete. Run `npm run seed` to reload teams.");
}

main().catch((err) => {
  console.error("Wipe failed:", err.message ?? err);
  process.exit(1);
});
