import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { cellClaimsGem, loadPaperResults, normTeam } from "@/lib/paperScores";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const BEAR_BONUS = 5;
const TOP_COLLECTOR_BONUS = 3;

export async function GET() {
  const supabase = getServiceClient();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name, code");
  if (teamError) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
  }

  const { data: gems, error: gemError } = await supabase
    .from("gems")
    .select("id, title, points");
  if (gemError) {
    return NextResponse.json({ error: "Failed to load gems." }, { status: 500 });
  }
  // Bear gems are marked with 🐻 in their title (see data/hunt.json).
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

  // Paper scorecards (Google Form responses) merge in when configured.
  const paper = await loadPaperResults();

  // team_id -> gem_id -> points awarded in the app
  const appPoints = new Map<number, Map<number, number>>();
  for (const s of approved ?? []) {
    const m = appPoints.get(s.team_id) ?? new Map<number, number>();
    m.set(s.gem_id, s.points_awarded ?? 0);
    appPoints.set(s.team_id, m);
  }

  interface Agg {
    points: number;
    count: number;
    paperCount: number;
    bears: Set<number>;
  }
  const totals = new Map<number, Agg>();

  for (const t of teams ?? []) {
    const approvedGems = appPoints.get(t.id) ?? new Map<number, number>();
    // The form asks for the team code; fall back to name just in case.
    const paperRow = paper.get(normTeam(t.code)) ?? paper.get(normTeam(t.name));

    let points = 0;
    let count = 0;
    let paperCount = 0;
    const bears = new Set<number>();

    for (const gem of gems ?? []) {
      const appAwarded = approvedGems.get(gem.id);
      const onPaper = paperRow ? cellClaimsGem(paperRow.gemsCell, gem.title) : false;
      if (appAwarded === undefined && !onPaper) continue;

      // A gem counts once: app review (with any reviewer adjustment) wins;
      // paper-only claims score the gem's listed points.
      points += appAwarded !== undefined ? appAwarded : gem.points;
      count += 1;
      if (appAwarded === undefined) {
        paperCount += 1;
        // Paper full-team-photo bonus: +1 when this photo is checked in the
        // form (app-side +1s are already inside points_awarded).
        if (paperRow && cellClaimsGem(paperRow.photosCell, gem.title)) points += 1;
      }
      if (bearGemIds.has(gem.id)) bears.add(gem.id);
    }

    totals.set(t.id, { points, count, paperCount, bears });
  }

  // Most-exhibits bonus goes to every team tied for the highest collected count.
  const maxCount = Math.max(0, ...[...totals.values()].map((t) => t.count));

  const rows: LeaderboardRow[] = (teams ?? []).map((t) => {
    const agg = totals.get(t.id)!;
    const bearBonus =
      bearGemIds.size > 0 && agg.bears.size === bearGemIds.size ? BEAR_BONUS : 0;
    const topCollectorBonus =
      maxCount > 0 && agg.count === maxCount ? TOP_COLLECTOR_BONUS : 0;
    return {
      team_id: t.id,
      team_name: t.name,
      approved_count: agg.count,
      paper_count: agg.paperCount,
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
