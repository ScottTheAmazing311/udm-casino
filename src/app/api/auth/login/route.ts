import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { playerId, passcode } = await request.json();

  if (!playerId || passcode === undefined) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: player, error } = await supabase
    .from("udm_players")
    .select()
    .eq("id", playerId)
    .eq("passcode", String(passcode))
    .single();

  if (error || !player) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  // Generate a simple session token
  const token = crypto.randomUUID();

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      icon: player.icon,
      color: player.color,
      has_changed_passcode: player.has_changed_passcode,
      avatar_config: player.avatar_config,
    },
    token,
  });
}
