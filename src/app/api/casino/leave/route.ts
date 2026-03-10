import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { handValue } from "@/lib/game-logic";

export async function POST(request: Request) {
  const { tableId, playerId } = await request.json();
  const supabase = createServiceClient();

  // Remove the player's seat
  await supabase
    .from("udm_casino_seats")
    .delete()
    .eq("table_id", tableId)
    .eq("player_id", playerId);

  // Check for active game session
  const { data: session } = await supabase
    .from("udm_game_sessions")
    .select("*")
    .eq("table_id", tableId)
    .neq("status", "complete")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ success: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = session.game_state as any;
  let status = session.status as string;
  let currentTurnPlayerId = session.current_turn_player_id as number | null;

  // Remove player from turn order
  const remainingPlayers = state.turnOrder.filter((pid: number) => pid !== playerId);

  // If no players left, complete the session
  if (remainingPlayers.length === 0) {
    await supabase
      .from("udm_game_sessions")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", session.id);
    return NextResponse.json({ success: true });
  }

  state.turnOrder = remainingPlayers;

  // Handle based on game phase
  if (status === "betting") {
    // Remove their bet if any
    delete state.bets[playerId];

    // For roulette, remove from ready list
    if (state.readyPlayers) {
      state.readyPlayers = state.readyPlayers.filter((pid: number) => pid !== playerId) as number[];
    }

    // Check if all remaining players have bet (blackjack)
    if (session.game_type === "blackjack") {
      const allBet = state.turnOrder.every((pid: number) => state.bets[pid]);
      if (allBet && state.turnOrder.length > 0) {
        // Don't auto-advance to dealing, let remaining players continue normally
      }
    }
  } else if (status === "playing") {
    // If it was their turn, advance to next player
    if (currentTurnPlayerId === playerId) {
      // Mark their hand as stand so they're skipped
      if (state.playerHands?.[playerId]) {
        state.playerHands[playerId].status = "stand";
      }

      // Find next active player
      const activePlayers = state.turnOrder.filter(
        (pid: number) => state.playerHands?.[pid]?.status === "playing"
      );

      if (activePlayers.length === 0) {
        // All done — resolve the game
        if (session.game_type === "blackjack") {
          // Dealer plays
          while (handValue(state.dealerHand) < 17) {
            state.dealerHand.push(state.deck.shift()!);
          }

          const dVal = handValue(state.dealerHand);
          const results: Record<number, { result: string; amount: number }> = {};

          for (const pid of state.turnOrder) {
            const h = state.playerHands[pid];
            if (!h) continue;
            const pVal = handValue(h.cards);
            const bet = state.bets[pid] || 0;

            if (h.status === "bust") {
              results[pid] = { result: "BUST", amount: -bet };
            } else if (dVal > 21 || pVal > dVal) {
              const isBlackjack = pVal === 21 && h.cards.length === 2;
              const win = isBlackjack ? Math.floor(bet * 1.5) : bet;
              results[pid] = { result: isBlackjack ? "BLACKJACK!" : "WIN", amount: win };
            } else if (pVal === dVal) {
              results[pid] = { result: "PUSH", amount: 0 };
            } else {
              results[pid] = { result: "LOSE", amount: -bet };
            }

            await supabase.rpc("update_player_chips", {
              p_player_id: pid,
              p_amount: results[pid].amount,
            });
          }

          state.results = results;
          status = "resolving";
          currentTurnPlayerId = null;
        }
      } else {
        // Advance to next active player
        currentTurnPlayerId = activePlayers[0];
        state.turnIndex = state.turnOrder.indexOf(activePlayers[0]);
      }
    } else {
      // Not their turn — just mark hand as forfeit
      if (state.playerHands?.[playerId]) {
        state.playerHands[playerId].status = "stand";
      }
    }

    // Forfeit their bet
    if (state.bets[playerId]) {
      await supabase.rpc("update_player_chips", {
        p_player_id: playerId,
        p_amount: -state.bets[playerId],
      });
    }
  }

  // Clean up their data from state
  delete state.playerHands?.[playerId];
  delete state.bets[playerId];

  // Save updated state
  await supabase
    .from("udm_game_sessions")
    .update({
      status,
      game_state: state,
      current_turn_player_id: currentTurnPlayerId,
      version: (session.version as number) + 1,
    })
    .eq("id", session.id);

  return NextResponse.json({ success: true });
}
