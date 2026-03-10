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

  // ── SPLIT ──────────────────────────────
  else if (action === "split") {
    if (status !== "playing") {
      return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    }
    if (currentTurnPlayerId !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const hand = state.playerHands[playerId];
    if (!hand || hand.status !== "playing" || hand.cards.length !== 2) {
      return NextResponse.json({ error: "Cannot split" }, { status: 400 });
    }

    // Check same rank (10, J, Q, K all count as 10)
    const rankVal = (r: string) => ["10", "J", "Q", "K"].includes(r) ? 10 : r;
    if (rankVal(hand.cards[0].rank) !== rankVal(hand.cards[1].rank)) {
      return NextResponse.json({ error: "Cards must be the same rank to split" }, { status: 400 });
    }

    // Check chips for second bet
    const { data: player } = await supabase
      .from("udm_players")
      .select("chips")
      .eq("id", playerId)
      .single();

    const bet = state.bets[playerId];
    if (!player || player.chips < bet * 2) {
      return NextResponse.json({ error: "Insufficient chips to split" }, { status: 400 });
    }

    // Split: second card goes to split hand, deal one new card to each
    hand.splitHand = [hand.cards.pop()!, state.deck.shift()!];
    hand.cards.push(state.deck.shift()!);
    hand.splitStatus = "playing";
    hand.activeSplit = false; // play main hand first

    // Double the bet (split bet matches original)
    state.bets[playerId] = bet * 2;

    // Check if main hand auto-stands at 21
    if (handValue(hand.cards) === 21) {
      hand.status = "stand";
      // Move to split hand
      hand.activeSplit = true;
      if (handValue(hand.splitHand) === 21) {
        hand.splitStatus = "stand";
        hand.activeSplit = false;
      }
    }

    state.playerHands[playerId] = hand;
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
    if (!hand) {
      return NextResponse.json({ error: "Invalid hand state" }, { status: 400 });
    }

    // Determine which hand is active (main or split)
    const playingSplit = hand.activeSplit && hand.splitStatus === "playing";
    const activeCards = playingSplit ? hand.splitHand! : hand.cards;
    const activeStatus = playingSplit ? hand.splitStatus! : hand.status;

    if (activeStatus !== "playing") {
      return NextResponse.json({ error: "Invalid hand state" }, { status: 400 });
    }

    if (action === "hit") {
      activeCards.push(state.deck.shift()!);
      const val = handValue(activeCards);
      if (val > 21) {
        if (playingSplit) hand.splitStatus = "bust";
        else hand.status = "bust";
      } else if (val === 21) {
        if (playingSplit) hand.splitStatus = "stand";
        else hand.status = "stand";
      }
    } else if (action === "stand") {
      if (playingSplit) hand.splitStatus = "stand";
      else hand.status = "stand";
    } else if (action === "double") {
      const { data: player } = await supabase
        .from("udm_players")
        .select("chips")
        .eq("id", playerId)
        .single();

      if (player) {
        const halfBet = state.bets[playerId] / 2;
        const extraBet = Math.min(halfBet, player.chips - state.bets[playerId]);
        state.bets[playerId] += extraBet;
      }

      activeCards.push(state.deck.shift()!);
      const val = handValue(activeCards);
      if (playingSplit) {
        hand.splitStatus = val > 21 ? "bust" : "stand";
      } else {
        hand.status = val > 21 ? "bust" : "stand";
      }
    }

    // If main hand done and split hand exists and not yet played, switch to split
    if (!playingSplit && hand.status !== "playing" && hand.splitHand && hand.splitStatus === "playing") {
      hand.activeSplit = true;
    }
    // If split hand done, mark activeSplit false
    if (playingSplit && hand.splitStatus !== "playing") {
      hand.activeSplit = false;
    }

    if (playingSplit) {
      hand.splitHand = activeCards;
    } else {
      hand.cards = activeCards;
    }

    state.playerHands[playerId] = hand;

    // Check if player is fully done (both hands if split)
    const isPlayerDone = (pid: number) => {
      const h = state.playerHands[pid];
      if (!h) return true;
      if (h.status === "playing") return false;
      if (h.splitHand && h.splitStatus === "playing") return false;
      return true;
    };

    const allDone = state.turnOrder.every((pid) => isPlayerDone(pid));

    if (allDone) {
      while (handValue(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.shift()!);
      }

      const dVal = handValue(state.dealerHand);
      const results: Record<number, BlackjackResult> = {};

      for (const pid of state.turnOrder) {
        const h = state.playerHands[pid];
        const totalBet = state.bets[pid] || 0;
        let totalAmount = 0;
        const resultParts: string[] = [];

        // Resolve main hand
        const halfBet = h.splitHand ? totalBet / 2 : totalBet;
        const pVal = handValue(h.cards);

        if (h.status === "bust") {
          totalAmount -= halfBet;
          resultParts.push("BUST");
        } else if (dVal > 21 || pVal > dVal) {
          const isBlackjack = pVal === 21 && h.cards.length === 2 && !h.splitHand;
          const win = isBlackjack ? Math.floor(halfBet * 1.5) : halfBet;
          totalAmount += win;
          resultParts.push(isBlackjack ? "BLACKJACK!" : "WIN");
        } else if (pVal === dVal) {
          resultParts.push("PUSH");
        } else {
          totalAmount -= halfBet;
          resultParts.push("LOSE");
        }

        // Resolve split hand if exists
        if (h.splitHand) {
          const sVal = handValue(h.splitHand);
          if (h.splitStatus === "bust") {
            totalAmount -= halfBet;
            resultParts.push("BUST");
          } else if (dVal > 21 || sVal > dVal) {
            totalAmount += halfBet;
            resultParts.push("WIN");
          } else if (sVal === dVal) {
            resultParts.push("PUSH");
          } else {
            totalAmount -= halfBet;
            resultParts.push("LOSE");
          }
        }

        results[pid] = {
          result: h.splitHand ? resultParts.join(" / ") : resultParts[0],
          amount: totalAmount,
        };

        await supabase.rpc("update_player_chips", {
          p_player_id: pid,
          p_amount: results[pid].amount,
        });

        await supabase.from("udm_game_results").insert({
          session_id: session.id,
          player_id: pid,
          bet_amount: totalBet,
          payout: results[pid].amount,
          hand_description: results[pid].result,
        });
      }

      state.results = results;
      status = "resolving";
      currentTurnPlayerId = null;
    } else {
      // Advance to next player who isn't done
      let nextIdx = state.turnIndex;
      do {
        nextIdx = (nextIdx + 1) % state.turnOrder.length;
      } while (
        isPlayerDone(state.turnOrder[nextIdx]) &&
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
