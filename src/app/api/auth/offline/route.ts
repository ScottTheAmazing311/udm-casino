import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { playerId } = await request.json();
  if (!playerId) {
    return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  await supabase
    .from("udm_players")
    .update({ is_online: false })
    .eq("id", playerId);

  // Remove their seats so they don't block tables
  await supabase
    .from("udm_casino_seats")
    .delete()
    .eq("player_id", playerId);

  return NextResponse.json({ success: true });
}
