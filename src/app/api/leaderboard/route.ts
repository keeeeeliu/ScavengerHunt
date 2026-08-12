import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServiceClient();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name");
  if (teamError) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
  }

  const { data: approved, error: subError } = await supabase
    .from("submissions")
    .select("team_id, points_awarded")
    .eq("status", "approved");
  if (subError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  const totals = new Map<number, { points: number; count: number }>();
  for (const s of approved ?? []) {
    const cur = totals.get(s.team_id) ?? { points: 0, count: 0 };
    cur.points += s.points_awarded ?? 0;
    cur.count += 1;
    totals.set(s.team_id, cur);
  }

  const rows: LeaderboardRow[] = (teams ?? []).map((t) => {
    const agg = totals.get(t.id) ?? { points: 0, count: 0 };
    return {
      team_id: t.id,
      team_name: t.name,
      approved_count: agg.count,
      points: agg.points,
    };
  });

  rows.sort((a, b) => b.points - a.points || b.approved_count - a.approved_count || a.team_name.localeCompare(b.team_name));

  return NextResponse.json({ leaderboard: rows });
}
