import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/adminAuth";
import type { Gem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { submissionId?: number; action?: string; points?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const submissionId = Number(body.submissionId);
  const action = body.action;
  if (!submissionId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
  }

  const supabase = getServiceClient();

  let points = 0;
  if (action === "approve") {
    if (typeof body.points === "number" && Number.isFinite(body.points)) {
      points = Math.max(0, Math.round(body.points));
    } else {
      // Default to the gem's configured point value.
      const { data: sub } = await supabase
        .from("submissions")
        .select("gem_id")
        .eq("id", submissionId)
        .maybeSingle<{ gem_id: number }>();
      if (sub) {
        const { data: gem } = await supabase
          .from("gems")
          .select("points")
          .eq("id", sub.gem_id)
          .maybeSingle<Pick<Gem, "points">>();
        points = gem?.points ?? 0;
      }
    }
  }

  const { data: updated, error } = await supabase
    .from("submissions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      points_awarded: action === "approve" ? points : 0,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select("id, status, points_awarded, reviewed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not update submission." }, { status: 500 });
  }

  return NextResponse.json({ submission: updated });
}
