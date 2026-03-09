import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const { playerId, playerName, gameType } = await request.json();

  if (!playerId || !playerName) {
    return NextResponse.json({ error: "Missing player info" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const joinCode = generateJoinCode();

  // Create table
  const { data: table, error: tableErr } = await supabase
    .from("udm_tables")
    .insert({
      join_code: joinCode,
      game_type: gameType || "blackjack",
      host_player_id: playerId,
      status: "waiting",
    })
    .select()
    .single();

  if (tableErr) {
    return NextResponse.json({ error: tableErr.message }, { status: 500 });
  }

  // Add host as first seat
  const { error: seatErr } = await supabase.from("udm_seats").insert({
    table_id: table.id,
    player_id: playerId,
    player_name: playerName,
    chips: 1000,
  });

  if (seatErr) {
    return NextResponse.json({ error: seatErr.message }, { status: 500 });
  }

  // Create initial game state
  const { error: stateErr } = await supabase.from("udm_game_state").insert({
    table_id: table.id,
    phase: "waiting",
    state: {
      deck: [],
      dealerHand: [],
      playerHands: {},
      bets: {},
      results: null,
      turnOrder: [],
      turnIndex: 0,
    },
    version: 0,
  });

  if (stateErr) {
    return NextResponse.json({ error: stateErr.message }, { status: 500 });
  }

  return NextResponse.json({ table, joinCode });
}
