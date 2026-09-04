import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name, code")
    .order("id", { ascending: true });
  if (teamError) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
  }

  const { data: subs, error: subError } = await supabase
    .from("submissions")
    .select("team_id, status, points_awarded");
  if (subError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  const agg = new Map<number, { submitted: number; approved: number; points: number }>();
  for (const s of subs ?? []) {
    const cur = agg.get(s.team_id) ?? { submitted: 0, approved: 0, points: 0 };
    cur.submitted += 1;
    if (s.status === "approved") {
      cur.approved += 1;
      cur.points += s.points_awarded ?? 0;
    }
    agg.set(s.team_id, cur);
  }

  const rows = (teams ?? []).map((t) => {
    const a = agg.get(t.id) ?? { submitted: 0, approved: 0, points: 0 };
    return { id: t.id, name: t.name, code: t.code, ...a };
  });

  return NextResponse.json({ teams: rows });
}
