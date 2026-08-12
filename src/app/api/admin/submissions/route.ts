import { NextResponse } from "next/server";
import { getServiceClient, PHOTOS_BUCKET } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

interface JoinedSubmission {
  id: number;
  team_id: number;
  gem_id: number;
  photo_path: string;
  status: string;
  points_awarded: number;
  submitted_at: string;
  reviewed_at: string | null;
  teams: { name: string } | null;
  gems: { title: string; points: number } | null;
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // optional filter

  const supabase = getServiceClient();

  let query = supabase
    .from("submissions")
    .select(
      "id, team_id, gem_id, photo_path, status, points_awarded, submitted_at, reviewed_at, teams(name), gems(title, points)"
    )
    .order("submitted_at", { ascending: true });

  if (status === "pending" || status === "approved" || status === "rejected") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<JoinedSubmission[]>();
  if (error) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  const paths = (data ?? []).map((s) => s.photo_path);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) signedByPath.set(item.path, item.signedUrl);
    }
  }

  const submissions = (data ?? []).map((s) => ({
    id: s.id,
    team_id: s.team_id,
    gem_id: s.gem_id,
    team_name: s.teams?.name ?? `Team ${s.team_id}`,
    gem_title: s.gems?.title ?? `Gem ${s.gem_id}`,
    gem_points: s.gems?.points ?? 0,
    status: s.status,
    points_awarded: s.points_awarded,
    submitted_at: s.submitted_at,
    reviewed_at: s.reviewed_at,
    photo_url: signedByPath.get(s.photo_path) ?? null,
  }));

  return NextResponse.json({ submissions });
}
