import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDeck, handValue } from "@/lib/game-logic";
import { BlackjackGameState, HandState, BlackjackResult } from "@/lib/types";

export async function POST(request: Request) {
  const { tableId, playerId, action, amount } = await request.json();

  const supabase = createServiceClient();

  // Get current state
  const { data: gs, error: gsErr } = await supabase
    .from("udm_game_state")
    .select()
    .eq("table_id", tableId)
    .single();

  if (gsErr || !gs) {
    return NextResponse.json({ error: "Game state not found" }, { status: 404 });
  }

  const state = gs.state as BlackjackGameState;
  let phase = gs.phase;
  let currentTurnPlayerId = gs.current_turn_player_id;
  const newVersion = gs.version + 1;

  // ── BET ─────────────────────────────────
  if (action === "bet") {
    if (phase !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    const { data: seat } = await supabase
      .from("udm_seats")
      .select()
      .eq("table_id", tableId)
      .eq("player_id", playerId)
      .single();

    if (!seat || seat.chips < amount) {
      return NextResponse.json({ error: "Insufficient chips" }, { status: 400 });
    }

    state.bets[playerId] = Math.min(amount, seat.chips);

    // Check if all players have bet
    const allBet = state.turnOrder.every((pid) => state.bets[pid]);

    if (allBet) {
      // Deal cards
      const deck = createDeck(4);
      let idx = 0;

      const playerHands: Record<number, HandState> = {};
      state.turnOrder.forEach((pid) => {
        playerHands[pid] = {
          cards: [deck[idx++], deck[idx++]],
          status: "playing",
        };
      });

      state.dealerHand = [deck[idx++], deck[idx++]];
      state.deck = deck.slice(idx);
      state.playerHands = playerHands;
      state.turnIndex = 0;
      phase = "playing";
      currentTurnPlayerId = state.turnOrder[0];
    }
  }

  // ── HIT / STAND / DOUBLE ────────────────
  else if (action === "hit" || action === "stand" || action === "double") {
    if (phase !== "playing") {
      return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    }
    if (currentTurnPlayerId !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const hand = state.playerHands[playerId];
    if (!hand || hand.status !== "playing") {
      return NextResponse.json({ error: "Invalid hand state" }, { status: 400 });
    }

    if (action === "hit") {
      hand.cards.push(state.deck.shift()!);
      const val = handValue(hand.cards);
      if (val > 21) hand.status = "bust";
      else if (val === 21) hand.status = "stand";
    } else if (action === "stand") {
      hand.status = "stand";
    } else if (action === "double") {
      const { data: seat } = await supabase
        .from("udm_seats")
        .select()
        .eq("table_id", tableId)
        .eq("player_id", playerId)
        .single();

      if (seat) {
        const extraBet = Math.min(state.bets[playerId], seat.chips - state.bets[playerId]);
        state.bets[playerId] += extraBet;
      }

      hand.cards.push(state.deck.shift()!);
      const val = handValue(hand.cards);
      hand.status = val > 21 ? "bust" : "stand";
    }

    state.playerHands[playerId] = hand;

    // Check if all players done
    const allDone = state.turnOrder.every(
      (pid) => state.playerHands[pid]?.status !== "playing"
    );

    if (allDone) {
      // Dealer plays
      while (handValue(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.shift()!);
      }

      // Calculate results and update chips
      const dVal = handValue(state.dealerHand);
      const results: Record<number, BlackjackResult> = {};

      for (const pid of state.turnOrder) {
        const h = state.playerHands[pid];
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

        // Update chips in DB
        const { data: seat } = await supabase
          .from("udm_seats")
          .select("chips")
          .eq("table_id", tableId)
          .eq("player_id", pid)
          .single();

        if (seat) {
          await supabase
            .from("udm_seats")
            .update({ chips: seat.chips + results[pid].amount })
            .eq("table_id", tableId)
            .eq("player_id", pid);
        }
      }

      state.results = results;
      phase = "results";
      currentTurnPlayerId = null;
    } else {
      // Advance to next active player
      let nextIdx = state.turnIndex;
      do {
        nextIdx = (nextIdx + 1) % state.turnOrder.length;
      } while (
        state.playerHands[state.turnOrder[nextIdx]]?.status !== "playing" &&
        nextIdx !== state.turnIndex
      );
      state.turnIndex = nextIdx;
      currentTurnPlayerId = state.turnOrder[nextIdx];
    }
  }

  // ── NEW ROUND ──────────────────────────
  else if (action === "new-round") {
    state.deck = [];
    state.dealerHand = [];
    state.playerHands = {};
    state.bets = {};
    state.results = null;
    state.turnIndex = 0;
    phase = "betting";
    currentTurnPlayerId = null;
  }

  else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Save state
  const { error: updateErr } = await supabase
    .from("udm_game_state")
    .update({
      phase,
      state,
      current_turn_player_id: currentTurnPlayerId,
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("table_id", tableId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, phase, state, version: newVersion });
}
