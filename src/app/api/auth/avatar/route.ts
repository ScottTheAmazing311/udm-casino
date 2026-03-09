import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { playerId, avatarConfig } = await request.json();

  if (!playerId || !avatarConfig) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("udm_players")
    .update({ avatar_config: avatarConfig })
    .eq("id", playerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
