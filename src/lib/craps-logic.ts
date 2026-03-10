import { CrapsBet, CrapsResult, CrapsPhase } from "./types";

export function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function diceSum(dice: [number, number]): number {
  return dice[0] + dice[1];
}

// Determine what happens after a come-out roll
export function comeOutResult(sum: number): "natural" | "craps" | "point" {
  if (sum === 7 || sum === 11) return "natural";
  if (sum === 2 || sum === 3 || sum === 12) return "craps";
  return "point";
}

// Determine what happens during point phase
export function pointResult(sum: number, point: number): "hit" | "seven-out" | "continue" {
  if (sum === point) return "hit";
  if (sum === 7) return "seven-out";
  return "continue";
}

// Field bet pays: 2x on 2 or 12, 1x on 3,4,9,10,11
export function isFieldWin(sum: number): boolean {
  return [2, 3, 4, 9, 10, 11, 12].includes(sum);
}

export function fieldMultiplier(sum: number): number {
  if (sum === 2 || sum === 12) return 2;
  if ([3, 4, 9, 10, 11].includes(sum)) return 1;
  return 0;
}

// Place bets pay 7:6 for 6/8
export function placeWin(sum: number, placeNumber: 6 | 8): boolean {
  return sum === placeNumber;
}

export function placeLoss(sum: number): boolean {
  return sum === 7;
}

// Resolve all bets for all players after a roll
export function resolveRoll(
  bets: Record<number, CrapsBet[]>,
  dice: [number, number],
  point: number | null,
  phase: CrapsPhase,
  turnOrder: number[]
): {
  results: Record<number, CrapsResult>;
  newPoint: number | null;
  newPhase: CrapsPhase;
  description: string;
} {
  const sum = diceSum(dice);
  const results: Record<number, CrapsResult> = {};
  let newPoint = point;
  let newPhase: CrapsPhase = phase;
  let description = "";

  // Initialize results for all players
  for (const pid of turnOrder) {
    results[pid] = { result: "", amount: 0 };
  }

  if (phase === "come-out") {
    const outcome = comeOutResult(sum);

    if (outcome === "natural") {
      description = sum === 7 ? "Natural 7!" : "Yo 11!";
      // Pass wins, Don't Pass loses
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "pass") {
            totalAmount += bet.amount;
            parts.push(`Pass +$${bet.amount}`);
          } else if (bet.type === "dontpass") {
            totalAmount -= bet.amount;
            parts.push(`Don't Pass -$${bet.amount}`);
          } else if (bet.type === "field") {
            if (isFieldWin(sum)) {
              const mult = fieldMultiplier(sum);
              totalAmount += bet.amount * mult;
              parts.push(`Field +$${bet.amount * mult}`);
            } else {
              totalAmount -= bet.amount;
              parts.push(`Field -$${bet.amount}`);
            }
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPhase = "resolving";
    } else if (outcome === "craps") {
      description = sum === 2 ? "Snake Eyes!" : sum === 3 ? "Ace Deuce!" : "Boxcars!";
      // Pass loses, Don't Pass wins (except 12 is push for Don't Pass)
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "pass") {
            totalAmount -= bet.amount;
            parts.push(`Pass -$${bet.amount}`);
          } else if (bet.type === "dontpass") {
            if (sum === 12) {
              parts.push("Don't Pass Push");
            } else {
              totalAmount += bet.amount;
              parts.push(`Don't Pass +$${bet.amount}`);
            }
          } else if (bet.type === "field") {
            if (isFieldWin(sum)) {
              const mult = fieldMultiplier(sum);
              totalAmount += bet.amount * mult;
              parts.push(`Field +$${bet.amount * mult}`);
            } else {
              totalAmount -= bet.amount;
              parts.push(`Field -$${bet.amount}`);
            }
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPhase = "resolving";
    } else {
      // Point established
      newPoint = sum;
      description = `Point is ${sum}!`;

      // Resolve field bets (they resolve every roll)
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "field") {
            if (isFieldWin(sum)) {
              const mult = fieldMultiplier(sum);
              totalAmount += bet.amount * mult;
              parts.push(`Field +$${bet.amount * mult}`);
            } else {
              totalAmount -= bet.amount;
              parts.push(`Field -$${bet.amount}`);
            }
          }
        }

        if (parts.length > 0) {
          results[pid] = { result: parts.join(", "), amount: totalAmount };
        }
      }

      newPhase = "point";
    }
  } else if (phase === "point" && point !== null) {
    const outcome = pointResult(sum, point);

    if (outcome === "hit") {
      description = `Hit the point ${point}!`;
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "pass") {
            totalAmount += bet.amount;
            parts.push(`Pass +$${bet.amount}`);
          } else if (bet.type === "dontpass") {
            totalAmount -= bet.amount;
            parts.push(`Don't Pass -$${bet.amount}`);
          } else if (bet.type === "field") {
            if (isFieldWin(sum)) {
              const mult = fieldMultiplier(sum);
              totalAmount += bet.amount * mult;
              parts.push(`Field +$${bet.amount * mult}`);
            } else {
              totalAmount -= bet.amount;
              parts.push(`Field -$${bet.amount}`);
            }
          } else if (bet.type === "place6" && sum === 6) {
            const win = Math.floor(bet.amount * 7 / 6);
            totalAmount += win;
            parts.push(`Place 6 +$${win}`);
          } else if (bet.type === "place8" && sum === 8) {
            const win = Math.floor(bet.amount * 7 / 6);
            totalAmount += win;
            parts.push(`Place 8 +$${win}`);
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPoint = null;
      newPhase = "resolving";
    } else if (outcome === "seven-out") {
      description = "Seven out!";
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "pass") {
            totalAmount -= bet.amount;
            parts.push(`Pass -$${bet.amount}`);
          } else if (bet.type === "dontpass") {
            totalAmount += bet.amount;
            parts.push(`Don't Pass +$${bet.amount}`);
          } else if (bet.type === "field") {
            totalAmount -= bet.amount;
            parts.push(`Field -$${bet.amount}`);
          } else if (bet.type === "place6" || bet.type === "place8") {
            totalAmount -= bet.amount;
            parts.push(`${bet.type === "place6" ? "Place 6" : "Place 8"} -$${bet.amount}`);
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPoint = null;
      newPhase = "resolving";
    } else {
      // Continue — resolve field bets and place bets only
      description = `Rolled ${sum}`;
      for (const pid of turnOrder) {
        const playerBets = bets[pid] || [];
        let totalAmount = 0;
        const parts: string[] = [];

        for (const bet of playerBets) {
          if (bet.type === "field") {
            if (isFieldWin(sum)) {
              const mult = fieldMultiplier(sum);
              totalAmount += bet.amount * mult;
              parts.push(`Field +$${bet.amount * mult}`);
            } else {
              totalAmount -= bet.amount;
              parts.push(`Field -$${bet.amount}`);
            }
          } else if (bet.type === "place6" && sum === 6) {
            const win = Math.floor(bet.amount * 7 / 6);
            totalAmount += win;
            parts.push(`Place 6 +$${win}`);
          } else if (bet.type === "place8" && sum === 8) {
            const win = Math.floor(bet.amount * 7 / 6);
            totalAmount += win;
            parts.push(`Place 8 +$${win}`);
          }
        }

        if (parts.length > 0 || totalAmount !== 0) {
          results[pid] = { result: parts.join(", "), amount: totalAmount };
        }
      }
      // Stay in point phase, don't go to resolving
      newPhase = "point";
    }
  }

  return { results, newPoint, newPhase, description };
}
