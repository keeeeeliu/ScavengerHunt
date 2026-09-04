import { NextResponse } from "next/server";
import { getServiceClient, PHOTOS_BUCKET } from "@/lib/supabaseServer";
import type { Gem, Submission, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Missing team code." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const supabase = getServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, code, route_id")
    .eq("code", code)
    .maybeSingle<Team>();

  if (teamError) {
    return NextResponse.json({ error: "Failed to load team." }, { status: 500 });
  }
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  // Gems visible to this team: gems on their route, plus shared gems (route_id null).
  // A team with no route sees every gem.
  let gemQuery = supabase
    .from("gems")
    .select("id, slug, route_id, title, description, order_index, points")
    .order("order_index", { ascending: true });

  if (team.route_id !== null) {
    gemQuery = gemQuery.or(`route_id.eq.${team.route_id},route_id.is.null`);
  }

  const { data: gems, error: gemError } = await gemQuery.returns<Gem[]>();
  if (gemError) {
    return NextResponse.json({ error: "Failed to load gems." }, { status: 500 });
  }

  const { data: submissions, error: subError } = await supabase
    .from("submissions")
    .select(
      "id, team_id, gem_id, photo_path, status, points_awarded, submitted_at, reviewed_at"
    )
    .eq("team_id", team.id)
    .returns<Submission[]>();

  if (subError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  const subByGem = new Map<number, Submission>();
  for (const s of submissions ?? []) subByGem.set(s.gem_id, s);

  // Sign photo URLs so the team can preview what they submitted.
  const paths = (submissions ?? []).map((s) => s.photo_path);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) signedByPath.set(item.path, item.signedUrl);
    }
  }

  const merged = (gems ?? []).map((gem) => {
    const submission = subByGem.get(gem.id) ?? null;
    return {
      ...gem,
      submission: submission
        ? { ...submission, photo_url: signedByPath.get(submission.photo_path) ?? null }
        : null,
    };
  });

  return NextResponse.json({ team, gems: merged });
}
