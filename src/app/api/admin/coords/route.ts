import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { isAdmin } from "@/lib/adminAuth";
import { loadCoordOverrides, saveCoordOverrides } from "@/lib/mapCoords";

export const dynamic = "force-dynamic";

/** Save one gem's map position (organizer drag in /admin/map). */
export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { slug?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!slug || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid slug or coordinates." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const overrides = await loadCoordOverrides(supabase);
  overrides[slug] = { lat, lng };

  try {
    await saveCoordOverrides(supabase, overrides);
  } catch {
    return NextResponse.json({ error: "Could not save coordinates." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, lat, lng });
}
