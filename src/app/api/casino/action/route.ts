import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDeck, handValue } from "@/lib/game-logic";
import { BlackjackGameState, HandState, BlackjackResult, RouletteGameState } from "@/lib/types";
import { spinWheel, resolveAllBets, RouletteBet } from "@/lib/roulette-logic";

export async function POST(request: Request) {
  const { tableId, playerId, action, payload } = await request.json();

  const supabase = createServiceClient();

  // Get current session
  const { data: session, error: sessionErr } = await supabase
    .from("udm_game_sessions")
    .select("*")
    .eq("table_id", tableId)
    .neq("status", "complete")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "No active game session" }, { status: 404 });
  }

  // Route to game-specific handler
  if (session.game_type === "roulette") {
    return handleRouletteAction(session, tableId, playerId, action, payload, supabase);
  }

  return handleBlackjackAction(session, tableId, playerId, action, payload, supabase);
}

// ═══════════════════════════════════════════════════
// ROULETTE
// ═══════════════════════════════════════════════════

async function handleRouletteAction(
  session: Record<string, unknown>,
  tableId: string,
  playerId: number,
  action: string,
  payload: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createServiceClient>
) {
  const state = session.game_state as RouletteGameState;
  let status = session.status as string;
  const newVersion = (session.version as number) + 1;

  // ── PLACE BET ─────────────────────────
  if (action === "place-bet") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    const betType = payload?.betType as string;
    const betNumber = payload?.betNumber as number | undefined;
    const amount = payload?.amount as number;

    if (!betType || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
    }

    // Check player chips
    const { data: player } = await supabase
      .from("udm_players")
      .select("chips")
      .eq("id", playerId)
      .single();

    const existingBets = state.bets[playerId] || [];
    const totalBet = existingBets.reduce((sum, b) => sum + b.amount, 0) + amount;

    if (!player || player.chips < totalBet) {
      return NextResponse.json({ error: "Insufficient chips" }, { status: 400 });
    }

    const newBet: RouletteBet = { type: betType as RouletteBet["type"], amount };
    if (betType === "straight" && betNumber !== undefined) {
      newBet.number = betNumber;
    }

    if (!state.bets[playerId]) state.bets[playerId] = [];
    state.bets[playerId].push(newBet);
  }

  // ── CLEAR BETS ────────────────────────
  else if (action === "clear-bets") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }
    state.bets[playerId] = [];
    // Also un-ready the player
    state.readyPlayers = state.readyPlayers.filter((pid) => pid !== playerId);
  }

  // ── READY (spin) ──────────────────────
  else if (action === "ready") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    if (!state.bets[playerId] || state.bets[playerId].length === 0) {
      return NextResponse.json({ error: "Place at least one bet" }, { status: 400 });
    }

    if (!state.readyPlayers.includes(playerId)) {
      state.readyPlayers.push(playerId);
    }

    // Check if all players with bets are ready
    const allReady = state.turnOrder.every(
      (pid) => state.readyPlayers.includes(pid)
    );

    if (allReady) {
      // Spin the wheel
      const winningNumber = spinWheel();
      state.winningNumber = winningNumber;

      // Resolve all bets
      const results = resolveAllBets(state.bets as Record<number, RouletteBet[]>, winningNumber);
      state.results = results;

      // Update chips for all players
      for (const pid of state.turnOrder) {
        const result = results[pid];
        if (result) {
          await supabase.rpc("update_player_chips", {
            p_player_id: pid,
            p_amount: result.netAmount,
          });

          await supabase.from("udm_game_results").insert({
            session_id: session.id,
            player_id: pid,
            bet_amount: result.totalBet,
            payout: result.netAmount,
            hand_description: result.winningBets.length > 0
              ? `Won: ${result.winningBets.join(", ")}`
              : "No wins",
          });
        }
      }

      status = "resolving";
    }
  }

  // ── NEW ROUND ─────────────────────────
  else if (action === "new-round") {
    await supabase
      .from("udm_game_sessions")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", session.id);

    const { data: seats } = await supabase
      .from("udm_casino_seats")
      .select("*")
      .eq("table_id", tableId)
      .order("seat_number");

    if (!seats || seats.length === 0) {
      return NextResponse.json({ error: "No players seated" }, { status: 400 });
    }

    const turnOrder = seats.map((s) => s.player_id);

    const newState: RouletteGameState = {
      bets: {},
      readyPlayers: [],
      winningNumber: null,
      results: null,
      turnOrder,
    };

    const { data: newSession, error: newErr } = await supabase
      .from("udm_game_sessions")
      .insert({
        table_id: tableId,
        game_type: "roulette",
        status: "betting",
        game_state: newState,
        current_turn_player_id: null,
        round_number: (session.round_number as number) + 1,
      })
      .select()
      .single();

    if (newErr) {
      return NextResponse.json({ error: newErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session: newSession });
  }

  else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Save state
  const { error: updateErr } = await supabase
    .from("udm_game_sessions")
    .update({
      status,
      game_state: state,
      current_turn_player_id: null,
      version: newVersion,
    })
    .eq("id", session.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status, state, version: newVersion });
}

// ═══════════════════════════════════════════════════
// BLACKJACK
// ═══════════════════════════════════════════════════

async function handleBlackjackAction(
  session: Record<string, unknown>,
  tableId: string,
  playerId: number,
  action: string,
  payload: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createServiceClient>
) {
  const state = session.game_state as BlackjackGameState;
  let status = session.status as string;
  let currentTurnPlayerId = session.current_turn_player_id as number | null;
  const newVersion = (session.version as number) + 1;

  // ── BET ─────────────────────────────────
  if (action === "bet") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    const amount = (payload?.amount as number) || 0;

    const { data: player } = await supabase
      .from("udm_players")
      .select("chips")
      .eq("id", playerId)
      .single();

    if (!player || player.chips < amount) {
      return NextResponse.json({ error: "Insufficient chips" }, { status: 400 });
    }

    state.bets[playerId] = Math.min(amount, player.chips);

    const allBet = state.turnOrder.every((pid) => state.bets[pid]);

    if (allBet) {
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
      status = "playing";
      currentTurnPlayerId = state.turnOrder[0];
    }
  }

  // ── HIT / STAND / DOUBLE ────────────────
  else if (action === "hit" || action === "stand" || action === "double") {
    if (status !== "playing") {
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
      const { data: player } = await supabase
        .from("udm_players")
        .select("chips")
        .eq("id", playerId)
        .single();

      if (player) {
        const extraBet = Math.min(state.bets[playerId], player.chips - state.bets[playerId]);
        state.bets[playerId] += extraBet;
      }

      hand.cards.push(state.deck.shift()!);
      const val = handValue(hand.cards);
      hand.status = val > 21 ? "bust" : "stand";
    }

    state.playerHands[playerId] = hand;

    const allDone = state.turnOrder.every(
      (pid) => state.playerHands[pid]?.status !== "playing"
    );

    if (allDone) {
      while (handValue(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.shift()!);
      }

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

        await supabase.rpc("update_player_chips", {
          p_player_id: pid,
          p_amount: results[pid].amount,
        });

        await supabase.from("udm_game_results").insert({
          session_id: session.id,
          player_id: pid,
          bet_amount: bet,
          payout: results[pid].amount,
          hand_description: results[pid].result,
        });
      }

      state.results = results;
      status = "resolving";
      currentTurnPlayerId = null;
    } else {
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
    await supabase
      .from("udm_game_sessions")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", session.id);

    const { data: seats } = await supabase
      .from("udm_casino_seats")
      .select("*")
      .eq("table_id", tableId)
      .order("seat_number");

    if (!seats || seats.length === 0) {
      return NextResponse.json({ error: "No players seated" }, { status: 400 });
    }

    const turnOrder = seats.map((s) => s.player_id);

    const newState: BlackjackGameState = {
      deck: [],
      dealerHand: [],
      playerHands: {},
      bets: {},
      results: null,
      turnOrder,
      turnIndex: 0,
    };

    const { data: newSession, error: newErr } = await supabase
      .from("udm_game_sessions")
      .insert({
        table_id: tableId,
        game_type: session.game_type as string,
        status: "betting",
        game_state: newState,
        current_turn_player_id: null,
        round_number: (session.round_number as number) + 1,
      })
      .select()
      .single();

    if (newErr) {
      return NextResponse.json({ error: newErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session: newSession });
  }

  else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Save state
  const { error: updateErr } = await supabase
    .from("udm_game_sessions")
    .update({
      status,
      game_state: state,
      current_turn_player_id: currentTurnPlayerId,
      version: newVersion,
    })
    .eq("id", session.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status, state, version: newVersion });
}
