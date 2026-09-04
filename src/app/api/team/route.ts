import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Unambiguous alphabet: no 0/O, 1/I/L to avoid read-aloud mistakes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const MAX_ATTEMPTS = 8;

function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function POST(req: Request) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) {
    return NextResponse.json({ error: "Please enter a team name." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Team name is too long (40 chars max)." }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Retry on the rare code collision (teams.code is UNIQUE -> Postgres 23505).
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name, code, route_id: null })
      .select("id, name, code, route_id")
      .single();

    if (!error && team) {
      return NextResponse.json({ team });
    }
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "Could not create team. Try again." }, { status: 500 });
    }
    // else: code collision, loop and try a new code
  }

  return NextResponse.json(
    { error: "Could not generate a unique code. Try again." },
    { status: 500 }
  );
}
