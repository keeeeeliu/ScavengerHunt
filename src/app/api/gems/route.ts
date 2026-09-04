import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { loadCoordOverrides } from "@/lib/mapCoords";
import huntData from "../../../../data/hunt.json";

export const dynamic = "force-dynamic";

interface HuntFileGem {
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  points: number;
  lat?: number;
  lng?: number;
}

/**
 * Public gem list for the map: base data from data/hunt.json with organizer
 * coordinate overrides (set in /admin/map) merged on top.
 */
export async function GET() {
  const supabase = getServiceClient();
  const overrides = await loadCoordOverrides(supabase);

  const gems = (huntData.gems as HuntFileGem[]).map((g) => {
    const o = overrides[g.slug];
    return {
      slug: g.slug,
      title: g.title,
      description: g.description ?? null,
      order_index: g.order_index,
      points: g.points,
      lat: o?.lat ?? g.lat ?? null,
      lng: o?.lng ?? g.lng ?? null,
    };
  });

  return NextResponse.json({ gems });
}
