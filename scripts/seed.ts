/**
 * Seeds / refreshes routes, gems, and teams from data/hunt.json into Supabase.
 * Idempotent: upserts on natural keys (route.slug, gem.slug, team.code), so you
 * can edit the JSON and re-run without duplicating rows.
 *
 * Usage: npm run seed   (requires .env.local with Supabase service role key)
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config(); // fall back to .env

interface HuntData {
  routes: { slug: string; name: string }[];
  gems: {
    slug: string;
    route: string | null;
    title: string;
    description: string | null;
    order_index: number;
    points: number;
    /** Used by the /map page only; not stored in the database. */
    lat?: number;
    lng?: number;
  }[];
  teams: { name: string; code: string; route: string | null }[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding."
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const data = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/hunt.json"), "utf8")
  ) as HuntData;

  // 1. Routes (optional — a hunt with a single shared gem list has none)
  if (data.routes.length) {
    const { error: routeErr } = await supabase
      .from("routes")
      .upsert(data.routes, { onConflict: "slug" });
    if (routeErr) throw routeErr;
  }

  const { data: routes, error: routeFetchErr } = await supabase
    .from("routes")
    .select("id, slug");
  if (routeFetchErr) throw routeFetchErr;
  const routeIdBySlug = new Map(routes!.map((r) => [r.slug, r.id]));

  // 2. Gems
  const gemRows = data.gems.map((g) => ({
    slug: g.slug,
    route_id: g.route ? routeIdBySlug.get(g.route) ?? null : null,
    title: g.title,
    description: g.description,
    order_index: g.order_index,
    points: g.points,
  }));
  const { error: gemErr } = await supabase
    .from("gems")
    .upsert(gemRows, { onConflict: "slug" });
  if (gemErr) throw gemErr;

  // 3. Teams (optional). Teams are normally created live by participants via
  // /join, so this array is usually empty. Any listed here are pre-created.
  const teams = data.teams ?? [];
  if (teams.length) {
    const teamRows = teams.map((t) => ({
      name: t.name,
      code: t.code.toUpperCase(),
      route_id: t.route ? routeIdBySlug.get(t.route) ?? null : null,
    }));
    const { error: teamErr } = await supabase
      .from("teams")
      .upsert(teamRows, { onConflict: "code" });
    if (teamErr) throw teamErr;
  }

  console.log(
    `Seeded ${data.routes.length} routes, ${data.gems.length} gems, ${teams.length} teams.`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
