// European roulette wheel order
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export type RouletteBetType =
  | "straight"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "col1"
  | "col2"
  | "col3";

export interface RouletteBet {
  type: RouletteBetType;
  number?: number; // only for "straight" bets
  amount: number;
}

export interface RouletteResult {
  totalBet: number;
  totalWin: number;
  netAmount: number; // positive = profit, negative = loss
  winningBets: string[];
}

export function spinWheel(): number {
  return Math.floor(Math.random() * 37); // 0-36
}

export function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export function calculatePayout(bet: RouletteBet, winningNumber: number): number {
  if (winningNumber === 0) {
    // Zero only pays straight bets on 0
    if (bet.type === "straight" && bet.number === 0) return bet.amount * 36;
    return 0;
  }

  switch (bet.type) {
    case "straight":
      return bet.number === winningNumber ? bet.amount * 36 : 0;
    case "red":
      return RED_NUMBERS.has(winningNumber) ? bet.amount * 2 : 0;
    case "black":
      return BLACK_NUMBERS.has(winningNumber) ? bet.amount * 2 : 0;
    case "odd":
      return winningNumber % 2 === 1 ? bet.amount * 2 : 0;
    case "even":
      return winningNumber % 2 === 0 ? bet.amount * 2 : 0;
    case "low":
      return winningNumber >= 1 && winningNumber <= 18 ? bet.amount * 2 : 0;
    case "high":
      return winningNumber >= 19 && winningNumber <= 36 ? bet.amount * 2 : 0;
    case "dozen1":
      return winningNumber >= 1 && winningNumber <= 12 ? bet.amount * 3 : 0;
    case "dozen2":
      return winningNumber >= 13 && winningNumber <= 24 ? bet.amount * 3 : 0;
    case "dozen3":
      return winningNumber >= 25 && winningNumber <= 36 ? bet.amount * 3 : 0;
    case "col1":
      return winningNumber % 3 === 1 ? bet.amount * 3 : 0;
    case "col2":
      return winningNumber % 3 === 2 ? bet.amount * 3 : 0;
    case "col3":
      return winningNumber % 3 === 0 ? bet.amount * 3 : 0;
    default:
      return 0;
  }
}

export function resolveAllBets(
  bets: Record<number, RouletteBet[]>,
  winningNumber: number
): Record<number, RouletteResult> {
  const results: Record<number, RouletteResult> = {};

  for (const pid of Object.keys(bets)) {
    const playerBets = bets[Number(pid)];
    let totalBet = 0;
    let totalWin = 0;
    const winningBets: string[] = [];

    for (const bet of playerBets) {
      totalBet += bet.amount;
      const payout = calculatePayout(bet, winningNumber);
      if (payout > 0) {
        totalWin += payout;
        winningBets.push(
          bet.type === "straight" ? `#${bet.number}` : bet.type
        );
      }
    }

    results[Number(pid)] = {
      totalBet,
      totalWin,
      netAmount: totalWin - totalBet,
      winningBets,
    };
  }

  return results;
}
