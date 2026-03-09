import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { BlackjackGameState } from "@/lib/types";

export async function POST(request: Request) {
  const { tableId, playerId } = await request.json();

  const supabase = createServiceClient();

  // Verify host
  const { data: table } = await supabase
    .from("udm_tables")
    .select()
    .eq("id", tableId)
    .single();

  if (!table || table.host_player_id !== playerId) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }

  // Get seated players
  const { data: seats } = await supabase
    .from("udm_seats")
    .select()
    .eq("table_id", tableId)
    .order("joined_at");

  if (!seats || seats.length === 0) {
    return NextResponse.json({ error: "No players" }, { status: 400 });
  }

  // Transition to betting phase
  const turnOrder = seats.map((s) => s.player_id);

  const state: BlackjackGameState = {
    deck: [],
    dealerHand: [],
    playerHands: {},
    bets: {},
    results: null,
    turnOrder,
    turnIndex: 0,
  };

  const { error } = await supabase
    .from("udm_game_state")
    .update({
      phase: "betting",
      state,
      current_turn_player_id: null,
      version: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", tableId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update table status
  await supabase
    .from("udm_tables")
    .update({ status: "active" })
    .eq("id", tableId);

  return NextResponse.json({ success: true });
}
