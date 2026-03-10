import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createDeck, handValue } from "@/lib/game-logic";
import { BlackjackGameState, HandState, BlackjackResult, RouletteGameState, SlotsGameState, PokerGameState } from "@/lib/types";
import { spinWheel, resolveAllBets, RouletteBet } from "@/lib/roulette-logic";
import { spin as spinSlots } from "@/lib/slots-logic";
import { dealHoleCards, findNextActivePlayer, getActivePlayers, isRoundComplete, advancePhase, resolveShowdown } from "@/lib/poker-logic";

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

  if (session.game_type === "slots") {
    return handleSlotsAction(session, tableId, playerId, action, payload, supabase);
  }

  if (session.game_type === "poker") {
    return handlePokerAction(session, tableId, playerId, action, payload, supabase);
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

  const TURN_TIMEOUT_MS = 15000;
  const BET_TIMEOUT_MS = 30000;

  // ── CHECK TIMEOUT (any player can call) ──
  if (action === "check-timeout") {
    let changed = false;

    // Check turn timeout during playing phase
    if (status === "playing" && currentTurnPlayerId && state.turnStartedAt) {
      const elapsed = Date.now() - new Date(state.turnStartedAt).getTime();
      if (elapsed > TURN_TIMEOUT_MS) {
        // Auto-stand the timed-out player
        const hand = state.playerHands[currentTurnPlayerId];
        if (hand) {
          if (hand.activeSplit && hand.splitStatus === "playing") {
            hand.splitStatus = "stand";
            hand.activeSplit = false;
          } else if (hand.status === "playing") {
            hand.status = "stand";
            // If they have a split hand waiting, move to it
            if (hand.splitHand && hand.splitStatus === "playing") {
              hand.activeSplit = true;
              state.turnStartedAt = new Date().toISOString();
            }
          }
          state.playerHands[currentTurnPlayerId] = hand;
        }

        const isPlayerDone = (pid: number) => {
          const h = state.playerHands[pid];
          if (!h) return true;
          if (h.status === "playing") return false;
          if (h.splitHand && h.splitStatus === "playing") return false;
          return true;
        };

        if (isPlayerDone(currentTurnPlayerId)) {
          // Advance turn or resolve
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
              const halfBet = h.splitHand ? totalBet / 2 : totalBet;
              const pVal = handValue(h.cards);
              if (h.status === "bust") { totalAmount -= halfBet; resultParts.push("BUST"); }
              else if (dVal > 21 || pVal > dVal) {
                const isBJ = pVal === 21 && h.cards.length === 2 && !h.splitHand;
                totalAmount += isBJ ? Math.floor(halfBet * 1.5) : halfBet;
                resultParts.push(isBJ ? "BLACKJACK!" : "WIN");
              } else if (pVal === dVal) { resultParts.push("PUSH"); }
              else { totalAmount -= halfBet; resultParts.push("LOSE"); }
              if (h.splitHand) {
                const sVal = handValue(h.splitHand);
                if (h.splitStatus === "bust") { totalAmount -= halfBet; resultParts.push("BUST"); }
                else if (dVal > 21 || sVal > dVal) { totalAmount += halfBet; resultParts.push("WIN"); }
                else if (sVal === dVal) { resultParts.push("PUSH"); }
                else { totalAmount -= halfBet; resultParts.push("LOSE"); }
              }
              results[pid] = { result: h.splitHand ? resultParts.join(" / ") : resultParts[0], amount: totalAmount };
              await supabase.rpc("update_player_chips", { p_player_id: pid, p_amount: results[pid].amount });
            }
            state.results = results;
            status = "resolving";
            currentTurnPlayerId = null;
          } else {
            let nextIdx = state.turnIndex;
            do { nextIdx = (nextIdx + 1) % state.turnOrder.length; }
            while (isPlayerDone(state.turnOrder[nextIdx]) && nextIdx !== state.turnIndex);
            state.turnIndex = nextIdx;
            currentTurnPlayerId = state.turnOrder[nextIdx];
            state.turnStartedAt = new Date().toISOString();
          }
        }
        changed = true;
      }
    }

    // Check bet timeout — remove players who haven't bet
    if (status === "betting" && state.bettingStartedAt) {
      const elapsed = Date.now() - new Date(state.bettingStartedAt).getTime();
      if (elapsed > BET_TIMEOUT_MS) {
        const playersWithoutBets = state.turnOrder.filter((pid) => !state.bets[pid]);
        if (playersWithoutBets.length > 0 && playersWithoutBets.length < state.turnOrder.length) {
          // Remove non-bettors from the round
          state.turnOrder = state.turnOrder.filter((pid) => state.bets[pid]);
          // Remove their seats
          for (const pid of playersWithoutBets) {
            await supabase.from("udm_casino_seats").delete().eq("table_id", tableId).eq("player_id", pid);
          }
          // If all remaining have bet, deal
          const allBet = state.turnOrder.every((pid) => state.bets[pid]);
          if (allBet && state.turnOrder.length > 0) {
            const deck = createDeck(4);
            let idx = 0;
            const playerHands: Record<number, HandState> = {};
            state.turnOrder.forEach((pid) => {
              playerHands[pid] = { cards: [deck[idx++], deck[idx++]], status: "playing" };
            });
            state.dealerHand = [deck[idx++], deck[idx++]];
            state.deck = deck.slice(idx);
            state.playerHands = playerHands;
            state.turnIndex = 0;
            status = "playing";
            currentTurnPlayerId = state.turnOrder[0];
            state.turnStartedAt = new Date().toISOString();
          }
          changed = true;
        } else if (playersWithoutBets.length === state.turnOrder.length) {
          // Nobody bet — complete session
          await supabase.from("udm_game_sessions")
            .update({ status: "complete", completed_at: new Date().toISOString() })
            .eq("id", session.id);
          return NextResponse.json({ success: true, status: "complete" });
        }
      }
    }

    if (!changed) {
      return NextResponse.json({ success: true, noChange: true });
    }

    // Save and return
    const { error: updateErr } = await supabase.from("udm_game_sessions").update({
      status, game_state: state, current_turn_player_id: currentTurnPlayerId, version: newVersion,
    }).eq("id", session.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ success: true, status, state, version: newVersion });
  }

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
      state.turnStartedAt = new Date().toISOString();
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
      state.turnStartedAt = new Date().toISOString();
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
      bettingStartedAt: new Date().toISOString(),
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

// ═══════════════════════════════════════════════════
// SLOTS
// ═══════════════════════════════════════════════════

async function handleSlotsAction(
  session: Record<string, unknown>,
  tableId: string,
  playerId: number,
  action: string,
  payload: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createServiceClient>
) {
  const state = session.game_state as SlotsGameState;
  let status = session.status as string;
  const newVersion = (session.version as number) + 1;

  // ── SPIN (bet + spin in one action) ─────
  if (action === "spin") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    // Verify it's this player's turn
    if (state.turnOrder[state.currentSpinnerIndex] !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const amount = (payload?.amount as number) || 0;
    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
    }

    // Check player chips
    const { data: player } = await supabase
      .from("udm_players")
      .select("chips")
      .eq("id", playerId)
      .single();

    if (!player || player.chips < amount) {
      return NextResponse.json({ error: "Insufficient chips" }, { status: 400 });
    }

    // Spin the reels
    const result = spinSlots();

    state.bet = amount;
    state.reels = result.reels;
    state.multiplier = result.multiplier;
    state.winType = result.winType;
    state.winDescription = result.winDescription;

    const payout = result.multiplier > 0 ? amount * result.multiplier : 0;
    state.netAmount = payout - amount;

    // Update player chips
    await supabase.rpc("update_player_chips", {
      p_player_id: playerId,
      p_amount: state.netAmount,
    });

    // Record result
    await supabase.from("udm_game_results").insert({
      session_id: session.id,
      player_id: playerId,
      bet_amount: amount,
      payout: state.netAmount,
      hand_description: result.winDescription,
    });

    status = "resolving";
    state.spinStartedAt = new Date().toISOString();
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

    // Advance to next spinner (round-robin)
    let nextIndex = (state.currentSpinnerIndex + 1) % turnOrder.length;
    if (nextIndex >= turnOrder.length) nextIndex = 0;

    const newState: SlotsGameState = {
      bet: null,
      reels: null,
      multiplier: 0,
      winType: null,
      winDescription: null,
      netAmount: null,
      turnOrder,
      currentSpinnerIndex: nextIndex,
    };

    const { data: newSession, error: newErr } = await supabase
      .from("udm_game_sessions")
      .insert({
        table_id: tableId,
        game_type: "slots",
        status: "betting",
        game_state: newState,
        current_turn_player_id: turnOrder[nextIndex],
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
      current_turn_player_id: state.turnOrder[state.currentSpinnerIndex],
      version: newVersion,
    })
    .eq("id", session.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status, state, version: newVersion });
}

// ═══════════════════════════════════════════════════
// POKER (Texas Hold'em)
// ═══════════════════════════════════════════════════

async function handlePokerAction(
  session: Record<string, unknown>,
  tableId: string,
  playerId: number,
  action: string,
  payload: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createServiceClient>
) {
  const state = session.game_state as PokerGameState;
  let status = session.status as string;
  let currentTurnPlayerId = session.current_turn_player_id as number | null;
  const newVersion = (session.version as number) + 1;
  const TURN_TIMEOUT_MS = 30000;

  const saveAndReturn = async () => {
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
  };

  const checkRoundAndAdvance = () => {
    if (isRoundComplete(state)) {
      if (state.phase === "river" || getActivePlayers(state).length <= 1) {
        state.phase = "showdown";
        resolveShowdown(state);
        status = "resolving";
        currentTurnPlayerId = null;
      } else {
        advancePhase(state);
        currentTurnPlayerId = state.turnOrder[state.turnIndex];
        state.turnStartedAt = new Date().toISOString();
      }
    } else {
      state.turnIndex = findNextActivePlayer(state, (state.turnIndex + 1) % state.turnOrder.length);
      currentTurnPlayerId = state.turnOrder[state.turnIndex];
      state.turnStartedAt = new Date().toISOString();
    }
  };

  // ── CHECK TIMEOUT ────────────────────
  if (action === "check-timeout") {
    if (status === "playing" && currentTurnPlayerId && state.turnStartedAt) {
      const elapsed = Date.now() - new Date(state.turnStartedAt).getTime();
      if (elapsed > TURN_TIMEOUT_MS) {
        state.folded[currentTurnPlayerId] = true;
        state.actedThisRound[currentTurnPlayerId] = true;
        checkRoundAndAdvance();
        return saveAndReturn();
      }
    }
    return NextResponse.json({ success: true, noChange: true });
  }

  // ── DEAL ─────────────────────────────
  if (action === "deal") {
    if (status !== "betting") {
      return NextResponse.json({ error: "Not in betting phase" }, { status: 400 });
    }

    const { data: table } = await supabase
      .from("udm_casino_tables")
      .select("min_bet")
      .eq("id", tableId)
      .single();

    const bigBlind = table?.min_bet || 10;
    const smallBlind = Math.floor(bigBlind / 2);

    const numPlayers = state.turnOrder.length;
    const sbIdx = numPlayers === 2 ? state.dealerIndex : (state.dealerIndex + 1) % numPlayers;
    const bbIdx = (sbIdx + 1) % numPlayers;
    const sbPlayer = state.turnOrder[sbIdx];
    const bbPlayer = state.turnOrder[bbIdx];

    for (const [pid, amount] of [[sbPlayer, smallBlind], [bbPlayer, bigBlind]] as [number, number][]) {
      const { data: player } = await supabase
        .from("udm_players")
        .select("chips")
        .eq("id", pid)
        .single();

      if (!player || player.chips < amount) {
        return NextResponse.json({ error: `Player ${pid} doesn't have enough chips for blind` }, { status: 400 });
      }
    }

    dealHoleCards(state, smallBlind, bigBlind);
    status = "playing";
    currentTurnPlayerId = state.turnOrder[state.turnIndex];
    state.turnStartedAt = new Date().toISOString();

    return saveAndReturn();
  }

  // ── FOLD ─────────────────────────────
  if (action === "fold") {
    if (status !== "playing") return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    if (currentTurnPlayerId !== playerId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

    state.folded[playerId] = true;
    state.actedThisRound[playerId] = true;
    checkRoundAndAdvance();
    return saveAndReturn();
  }

  // ── CHECK ────────────────────────────
  if (action === "check") {
    if (status !== "playing") return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    if (currentTurnPlayerId !== playerId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    if ((state.roundBets[playerId] || 0) < state.currentBet) {
      return NextResponse.json({ error: "Cannot check, must call or raise" }, { status: 400 });
    }

    state.actedThisRound[playerId] = true;
    checkRoundAndAdvance();
    return saveAndReturn();
  }

  // ── CALL ─────────────────────────────
  if (action === "call") {
    if (status !== "playing") return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    if (currentTurnPlayerId !== playerId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

    const callAmount = state.currentBet - (state.roundBets[playerId] || 0);
    if (callAmount <= 0) return NextResponse.json({ error: "Nothing to call" }, { status: 400 });

    const { data: player } = await supabase.from("udm_players").select("chips").eq("id", playerId).single();
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const actualCall = Math.min(callAmount, player.chips);
    state.roundBets[playerId] = (state.roundBets[playerId] || 0) + actualCall;
    state.bets[playerId] = (state.bets[playerId] || 0) + actualCall;
    state.pot += actualCall;

    if (actualCall >= player.chips) state.allIn[playerId] = true;

    state.actedThisRound[playerId] = true;
    checkRoundAndAdvance();
    return saveAndReturn();
  }

  // ── RAISE ────────────────────────────
  if (action === "raise") {
    if (status !== "playing") return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    if (currentTurnPlayerId !== playerId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

    const raiseTotal = (payload?.amount as number) || 0;
    if (raiseTotal <= state.currentBet) return NextResponse.json({ error: "Raise must be more than current bet" }, { status: 400 });

    const { data: player } = await supabase.from("udm_players").select("chips").eq("id", playerId).single();
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const alreadyBet = state.roundBets[playerId] || 0;
    const needed = raiseTotal - alreadyBet;
    if (needed > player.chips) return NextResponse.json({ error: "Insufficient chips" }, { status: 400 });

    state.roundBets[playerId] = raiseTotal;
    state.bets[playerId] = (state.bets[playerId] || 0) + needed;
    state.pot += needed;
    state.currentBet = raiseTotal;

    if (needed >= player.chips) state.allIn[playerId] = true;

    for (const pid of state.turnOrder) {
      if (pid !== playerId && !state.folded[pid] && !state.allIn[pid]) {
        state.actedThisRound[pid] = false;
      }
    }
    state.actedThisRound[playerId] = true;
    state.lastRaiserIndex = state.turnIndex;

    checkRoundAndAdvance();
    return saveAndReturn();
  }

  // ── ALL-IN ───────────────────────────
  if (action === "all-in") {
    if (status !== "playing") return NextResponse.json({ error: "Not in playing phase" }, { status: 400 });
    if (currentTurnPlayerId !== playerId) return NextResponse.json({ error: "Not your turn" }, { status: 400 });

    const { data: player } = await supabase.from("udm_players").select("chips").eq("id", playerId).single();
    if (!player || player.chips <= 0) return NextResponse.json({ error: "No chips" }, { status: 400 });

    const allInAmount = player.chips;
    const newRoundBet = (state.roundBets[playerId] || 0) + allInAmount;

    state.roundBets[playerId] = newRoundBet;
    state.bets[playerId] = (state.bets[playerId] || 0) + allInAmount;
    state.pot += allInAmount;
    state.allIn[playerId] = true;

    if (newRoundBet > state.currentBet) {
      state.currentBet = newRoundBet;
      for (const pid of state.turnOrder) {
        if (pid !== playerId && !state.folded[pid] && !state.allIn[pid]) {
          state.actedThisRound[pid] = false;
        }
      }
      state.lastRaiserIndex = state.turnIndex;
    }

    state.actedThisRound[playerId] = true;
    checkRoundAndAdvance();
    return saveAndReturn();
  }

  // ── NEW ROUND ────────────────────────
  if (action === "new-round") {
    if (state.results) {
      for (const pid of state.turnOrder) {
        const result = state.results[pid];
        if (result) {
          await supabase.rpc("update_player_chips", { p_player_id: pid, p_amount: result.amount });
          await supabase.from("udm_game_results").insert({
            session_id: session.id,
            player_id: pid,
            bet_amount: state.bets[pid] || 0,
            payout: result.amount,
            hand_description: result.hand,
          });
        }
      }
    }

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
    const newDealerIndex = (state.dealerIndex + 1) % turnOrder.length;

    const newState: PokerGameState = {
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
      dealerIndex: newDealerIndex,
      lastRaiserIndex: null,
      actedThisRound: {},
      results: null,
    };

    const { data: newSession, error: newErr } = await supabase
      .from("udm_game_sessions")
      .insert({
        table_id: tableId,
        game_type: "poker",
        status: "betting",
        game_state: newState,
        current_turn_player_id: null,
        round_number: (session.round_number as number) + 1,
      })
      .select()
      .single();

    if (newErr) return NextResponse.json({ error: newErr.message }, { status: 500 });
    return NextResponse.json({ success: true, session: newSession });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
