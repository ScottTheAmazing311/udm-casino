import { CardType, PokerGameState, PokerPhase, PokerResult } from "./types";
import { createDeck, evaluatePokerHand } from "./game-logic";

export function createPokerState(turnOrder: number[], dealerIndex: number): PokerGameState {
  return {
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
    dealerIndex,
    lastRaiserIndex: null,
    actedThisRound: {},
    results: null,
  };
}

export function dealHoleCards(state: PokerGameState, smallBlind: number, bigBlind: number): PokerGameState {
  const deck = createDeck(1);
  let idx = 0;

  const playerHoles: Record<number, CardType[]> = {};
  for (const pid of state.turnOrder) {
    playerHoles[pid] = [deck[idx++], deck[idx++]];
    state.folded[pid] = false;
    state.allIn[pid] = false;
    state.bets[pid] = 0;
    state.roundBets[pid] = 0;
    state.actedThisRound[pid] = false;
  }

  state.deck = deck.slice(idx);
  state.playerHoles = playerHoles;

  // Post blinds
  const numPlayers = state.turnOrder.length;
  const sbIdx = numPlayers === 2 ? state.dealerIndex : (state.dealerIndex + 1) % numPlayers;
  const bbIdx = (sbIdx + 1) % numPlayers;

  const sbPlayer = state.turnOrder[sbIdx];
  const bbPlayer = state.turnOrder[bbIdx];

  state.bets[sbPlayer] = smallBlind;
  state.roundBets[sbPlayer] = smallBlind;
  state.bets[bbPlayer] = bigBlind;
  state.roundBets[bbPlayer] = bigBlind;
  state.pot = smallBlind + bigBlind;
  state.currentBet = bigBlind;

  // Action starts left of big blind
  state.turnIndex = (bbIdx + 1) % numPlayers;
  // Skip folded/all-in players
  state.turnIndex = findNextActivePlayer(state, state.turnIndex);
  state.lastRaiserIndex = bbIdx; // BB is the last "raiser" initially

  return state;
}

export function findNextActivePlayer(state: PokerGameState, fromIndex: number): number {
  const n = state.turnOrder.length;
  let idx = fromIndex;
  for (let i = 0; i < n; i++) {
    const pid = state.turnOrder[idx];
    if (!state.folded[pid] && !state.allIn[pid]) {
      return idx;
    }
    idx = (idx + 1) % n;
  }
  return fromIndex; // all folded or all-in
}

export function getActivePlayers(state: PokerGameState): number[] {
  return state.turnOrder.filter((pid) => !state.folded[pid]);
}

export function getActingPlayers(state: PokerGameState): number[] {
  return state.turnOrder.filter((pid) => !state.folded[pid] && !state.allIn[pid]);
}

export function isRoundComplete(state: PokerGameState): boolean {
  const acting = getActingPlayers(state);

  // If only one active player (rest folded), hand is over
  if (getActivePlayers(state).length <= 1) return true;

  // If no one can act (all-in or folded), round is complete
  if (acting.length === 0) return true;

  // All acting players must have acted and bets must be equal
  const allActed = acting.every((pid) => state.actedThisRound[pid]);
  if (!allActed) return false;

  // All acting players' round bets must match the current bet
  const allEqual = acting.every((pid) => state.roundBets[pid] === state.currentBet);
  return allEqual;
}

export function advancePhase(state: PokerGameState): PokerGameState {
  const phaseOrder: PokerPhase[] = ["preflop", "flop", "turn", "river", "showdown"];
  const currentIdx = phaseOrder.indexOf(state.phase);

  // Check if only one active player — skip to showdown
  if (getActivePlayers(state).length <= 1) {
    state.phase = "showdown";
    return state;
  }

  const nextPhase = phaseOrder[currentIdx + 1];
  state.phase = nextPhase;

  // Deal community cards
  if (nextPhase === "flop") {
    state.deck.shift(); // burn
    state.communityCards.push(state.deck.shift()!, state.deck.shift()!, state.deck.shift()!);
  } else if (nextPhase === "turn" || nextPhase === "river") {
    state.deck.shift(); // burn
    state.communityCards.push(state.deck.shift()!);
  }

  if (nextPhase !== "showdown") {
    // Reset round bets and acted flags
    for (const pid of state.turnOrder) {
      state.roundBets[pid] = 0;
      state.actedThisRound[pid] = false;
    }
    state.currentBet = 0;
    state.lastRaiserIndex = null;

    // Action starts left of dealer
    const startIdx = (state.dealerIndex + 1) % state.turnOrder.length;
    state.turnIndex = findNextActivePlayer(state, startIdx);
  }

  return state;
}

export function resolveShowdown(state: PokerGameState): PokerGameState {
  const active = getActivePlayers(state);
  const results: Record<number, PokerResult> = {};

  // Initialize all players with their losses
  for (const pid of state.turnOrder) {
    results[pid] = {
      hand: state.folded[pid] ? "Folded" : "",
      amount: -(state.bets[pid] || 0),
    };
  }

  if (active.length === 1) {
    // Last player standing wins the pot
    const winner = active[0];
    results[winner] = {
      hand: "Last Standing",
      amount: state.pot - (state.bets[winner] || 0),
    };
  } else {
    // Evaluate hands
    const evaluations: { pid: number; eval: { rank: number; name: string } }[] = [];
    for (const pid of active) {
      const allCards = [...(state.playerHoles[pid] || []), ...state.communityCards];
      const ev = evaluatePokerHand(allCards);
      evaluations.push({ pid, eval: ev });
      results[pid].hand = ev.name;
    }

    // Sort by rank descending
    evaluations.sort((a, b) => b.eval.rank - a.eval.rank);

    // Find winners (could be tie)
    const bestRank = evaluations[0].eval.rank;
    const winners = evaluations.filter((e) => e.eval.rank === bestRank);

    // Split pot among winners
    const share = Math.floor(state.pot / winners.length);
    for (const w of winners) {
      results[w.pid].amount = share - (state.bets[w.pid] || 0);
    }
    // Remainder goes to first winner
    const remainder = state.pot - share * winners.length;
    if (remainder > 0) {
      results[winners[0].pid].amount += remainder;
    }
  }

  state.results = results;
  return state;
}

export function sanitizeStateForPlayer(
  state: PokerGameState,
  playerId: number
): PokerGameState {
  // In showdown, reveal all hands
  if (state.phase === "showdown" && state.results) {
    return state;
  }

  // Hide other players' hole cards
  const sanitized = { ...state };
  const sanitizedHoles: Record<number, CardType[]> = {};

  for (const pid of state.turnOrder) {
    if (pid === playerId) {
      sanitizedHoles[pid] = state.playerHoles[pid] || [];
    } else {
      // Send face-down cards (blank cards so client knows count)
      sanitizedHoles[pid] = (state.playerHoles[pid] || []).map(() => ({
        suit: "?",
        rank: "?",
        id: "hidden",
      }));
    }
  }

  return { ...sanitized, playerHoles: sanitizedHoles };
}
