export interface Player {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface CardType {
  suit: string;
  rank: string;
  id: string;
}

export interface HandState {
  cards: CardType[];
  status: "playing" | "bust" | "stand";
  splitHand?: CardType[];
  splitStatus?: "playing" | "bust" | "stand";
  activeSplit?: boolean; // true = currently playing split hand
}

export interface BlackjackResult {
  result: string;
  amount: number;
}

export interface PokerHandEval {
  rank: number;
  name: string;
}

export interface CrapsBet {
  type: "pass" | "dontpass" | "field";
  amount: number;
}

export interface CrapsResult {
  result: string;
  amount: number;
}

export interface PokerWinner {
  player: Player;
  hand: string;
  amount: number;
}

export type ChipCounts = Record<number, number>;

export type Screen = "lobby" | "blackjack" | "poker" | "craps" | "roulette" | "leaderboard" | "table-lobby" | "multiplayer-blackjack";

// Multiplayer types
export interface GameTable {
  id: string;
  join_code: string;
  game_type: string;
  host_player_id: number;
  status: string;
  created_at: string;
}

export interface Seat {
  id: string;
  table_id: string;
  player_id: number;
  player_name: string;
  chips: number;
  is_connected: boolean;
  joined_at: string;
}

export type BlackjackPhase = "waiting" | "betting" | "playing" | "results";

export interface BlackjackGameState {
  deck: CardType[];
  dealerHand: CardType[];
  playerHands: Record<number, HandState>;
  bets: Record<number, number>;
  results: Record<number, BlackjackResult> | null;
  turnOrder: number[];
  turnIndex: number;
}

export interface RouletteGameState {
  bets: Record<number, { type: string; number?: number; amount: number }[]>;
  readyPlayers: number[];
  winningNumber: number | null;
  results: Record<number, { totalBet: number; totalWin: number; netAmount: number; winningBets: string[] }> | null;
  turnOrder: number[];
}

export interface GameStateRow {
  id: string;
  table_id: string;
  phase: BlackjackPhase;
  state: BlackjackGameState;
  current_turn_player_id: number | null;
  version: number;
  updated_at: string;
}
