import { NextResponse } from "next/server";
import { getServiceClient, PHOTOS_BUCKET } from "@/lib/supabaseServer";
import type { Gem, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB safety cap (client compresses first)

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const gemIdRaw = String(form.get("gemId") ?? "");
  const file = form.get("file");

  const gemId = Number.parseInt(gemIdRaw, 10);
  if (!code || Number.isNaN(gemId) || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing code, gem, or photo." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
  }

  const supabase = getServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, code, route_id")
    .eq("code", code)
    .maybeSingle<Team>();
  if (teamError || !team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const { data: gem, error: gemError } = await supabase
    .from("gems")
    .select("id, route_id")
    .eq("id", gemId)
    .maybeSingle<Pick<Gem, "id" | "route_id">>();
  if (gemError || !gem) {
    return NextResponse.json({ error: "Gem not found." }, { status: 404 });
  }

  // An approved gem is locked in: a teammate re-uploading must not reset it
  // to pending and wipe the points the team already earned.
  const { data: existing } = await supabase
    .from("submissions")
    .select("id, status")
    .eq("team_id", team.id)
    .eq("gem_id", gem.id)
    .maybeSingle<{ id: number; status: string }>();
  if (existing?.status === "approved") {
    return NextResponse.json(
      { error: "This gem is already approved — points are locked in. 🎉" },
      { status: 409 }
    );
  }

  // Stable path per team+gem so re-submissions overwrite the previous photo.
  const path = `${team.id}/${gem.id}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "0",
    });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }

  const { data: submission, error: upsertError } = await supabase
    .from("submissions")
    .upsert(
      {
        team_id: team.id,
        gem_id: gem.id,
        photo_path: path,
        status: "pending",
        points_awarded: 0,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
      },
      { onConflict: "team_id,gem_id" }
    )
    .select("id, team_id, gem_id, photo_path, status, points_awarded, submitted_at, reviewed_at")
    .single();

  if (upsertError) {
    return NextResponse.json({ error: "Could not save submission." }, { status: 500 });
  }

  return NextResponse.json({ submission });
}
