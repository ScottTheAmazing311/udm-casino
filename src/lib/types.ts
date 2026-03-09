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

export type Screen = "lobby" | "blackjack" | "poker" | "craps" | "leaderboard";
