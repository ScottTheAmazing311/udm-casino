import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const { tableId, playerId } = await request.json();
  const supabase = createServiceClient();

  // Get table info
  const { data: table } = await supabase
    .from("udm_casino_tables")
    .select("*")
    .eq("id", tableId)
    .single();

  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  // Get seated players
  const { data: seats } = await supabase
    .from("udm_casino_seats")
    .select("*")
    .eq("table_id", tableId)
    .order("seat_number");

  if (!seats || seats.length === 0) {
    return NextResponse.json({ error: "No players seated" }, { status: 400 });
  }

  // Check player is seated
  if (!seats.some((s) => s.player_id === playerId)) {
    return NextResponse.json({ error: "You are not seated" }, { status: 403 });
  }

  // Check no active session
  const { data: existing } = await supabase
    .from("udm_game_sessions")
    .select("id")
    .eq("table_id", tableId)
    .neq("status", "complete")
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Game already in progress" }, { status: 400 });
  }

  // Create new game session in betting phase
  const turnOrder = seats.map((s) => s.player_id);

  const gameState = table.game_type === "roulette"
    ? {
        bets: {},
        readyPlayers: [],
        winningNumber: null,
        results: null,
        turnOrder,
      }
    : table.game_type === "slots"
    ? {
        bet: null,
        reels: null,
        multiplier: 0,
        winType: null,
        winDescription: null,
        netAmount: null,
        turnOrder,
        currentSpinnerIndex: 0,
      }
    : table.game_type === "poker"
    ? {
        deck: [],
        communityCards: [],
        playerHoles: {},
        bets: {},
        roundBets: {},
        folded: {},
        allIn: {},
        phase: "preflop",
        pot: 0,
        currentBet: 0,
        turnOrder,
        turnIndex: 0,
        dealerIndex: 0,
        lastRaiserIndex: null,
        actedThisRound: {},
        results: null,
      }
    : {
        deck: [],
        dealerHand: [],
        playerHands: {},
        bets: {},
        results: null,
        turnOrder,
        turnIndex: 0,
        bettingStartedAt: new Date().toISOString(),
      };

  const { data: session, error } = await supabase
    .from("udm_game_sessions")
    .insert({
      table_id: tableId,
      game_type: table.game_type,
      status: "betting",
      game_state: gameState,
      current_turn_player_id: null,
      round_number: 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, session });
}
