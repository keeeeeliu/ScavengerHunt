import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const BEAR_BONUS = 5;
const TOP_COLLECTOR_BONUS = 3;

export async function GET() {
  const supabase = getServiceClient();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name");
  if (teamError) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
  }

  // Bear gems are marked with 🐻 in their title (see data/hunt.json).
  const { data: gems, error: gemError } = await supabase
    .from("gems")
    .select("id, title");
  if (gemError) {
    return NextResponse.json({ error: "Failed to load gems." }, { status: 500 });
  }
  const bearGemIds = new Set(
    (gems ?? []).filter((g) => g.title.includes("🐻")).map((g) => g.id)
  );

  const { data: approved, error: subError } = await supabase
    .from("submissions")
    .select("team_id, gem_id, points_awarded")
    .eq("status", "approved");
  if (subError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  const totals = new Map<number, { points: number; count: number; bears: Set<number> }>();
  for (const s of approved ?? []) {
    const cur = totals.get(s.team_id) ?? { points: 0, count: 0, bears: new Set<number>() };
    cur.points += s.points_awarded ?? 0;
    cur.count += 1;
    if (bearGemIds.has(s.gem_id)) cur.bears.add(s.gem_id);
    totals.set(s.team_id, cur);
  }

  // Most-exhibits bonus goes to every team tied for the highest approved count.
  const maxCount = Math.max(0, ...[...totals.values()].map((t) => t.count));

  const rows: LeaderboardRow[] = (teams ?? []).map((t) => {
    const agg = totals.get(t.id) ?? { points: 0, count: 0, bears: new Set<number>() };
    const bearBonus =
      bearGemIds.size > 0 && agg.bears.size === bearGemIds.size ? BEAR_BONUS : 0;
    const topCollectorBonus =
      maxCount > 0 && agg.count === maxCount ? TOP_COLLECTOR_BONUS : 0;
    return {
      team_id: t.id,
      team_name: t.name,
      approved_count: agg.count,
      base_points: agg.points,
      bear_bonus: bearBonus,
      top_collector_bonus: topCollectorBonus,
      points: agg.points + bearBonus + topCollectorBonus,
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.approved_count - a.approved_count ||
      a.team_name.localeCompare(b.team_name)
  );

  return NextResponse.json({ leaderboard: rows });
}
