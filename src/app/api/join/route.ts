import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Please enter a team code." }, { status: 400 });
  }
  // Codes are short and alphanumeric; anything else can't match a team.
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    return NextResponse.json(
      { error: "That team code was not found. Double-check with an organizer." },
      { status: 404 }
    );
  }

  const supabase = getServiceClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, code, route_id")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!team) {
    return NextResponse.json(
      { error: "That team code was not found. Double-check with an organizer." },
      { status: 404 }
    );
  }

  return NextResponse.json({ team });
}
