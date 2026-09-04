import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient, PHOTOS_BUCKET } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/adminAuth";
import huntData from "../../../../../data/hunt.json";

export const dynamic = "force-dynamic";

async function emptyPhotoBucket(supabase: SupabaseClient, prefix = ""): Promise<number> {
  const { data: entries, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw error;
  if (!entries || entries.length === 0) return 0;

  let removed = 0;
  const files: string[] = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      removed += await emptyPhotoBucket(supabase, path); // folder: recurse
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

/**
 * DESTRUCTIVE: full game reset — deletes every photo, submission, and team,
 * then reseeds gems and teams from data/hunt.json. Gem points and calibrated
 * map coordinates survive. Requires the admin passcode header AND the reset
 * code in the body (RESET_PASSCODE env var; falls back to ADMIN_PASSCODE).
 */
export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { resetCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const expected = process.env.RESET_PASSCODE || process.env.ADMIN_PASSCODE;
  if (!expected || body.resetCode !== expected) {
    return NextResponse.json({ error: "Wrong reset code." }, { status: 403 });
  }

  const supabase = getServiceClient();

  try {
    const photos = await emptyPhotoBucket(supabase);

    const { error: subErr } = await supabase.from("submissions").delete().gte("id", 0);
    if (subErr) throw subErr;

    const { error: teamErr } = await supabase.from("teams").delete().gte("id", 0);
    if (teamErr) throw teamErr;

    // Reseed gems (points/titles refresh; slug is the stable key)...
    const gemRows = (huntData.gems as {
      slug: string; title: string; description: string | null;
      order_index: number; points: number;
    }[]).map((g) => ({
      slug: g.slug,
      route_id: null,
      title: g.title,
      description: g.description,
      order_index: g.order_index,
      points: g.points,
    }));
    const { error: gemErr } = await supabase
      .from("gems")
      .upsert(gemRows, { onConflict: "slug" });
    if (gemErr) throw gemErr;

    // ...and teams (same codes as before, so phones re-join seamlessly).
    const teamRows = (huntData.teams as { name: string; code: string }[]).map((t) => ({
      name: t.name,
      code: t.code.toUpperCase(),
      route_id: null,
    }));
    const { error: seedErr } = await supabase
      .from("teams")
      .upsert(teamRows, { onConflict: "code" });
    if (seedErr) throw seedErr;

    return NextResponse.json({
      ok: true,
      photos_deleted: photos,
      teams_seeded: teamRows.length,
      gems_seeded: gemRows.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Reset failed partway — check the database, then try again." },
      { status: 500 }
    );
  }
}
