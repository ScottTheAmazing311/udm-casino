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

// Place bets: 7:6 for 6/8, 7:5 for 5/9, 9:5 for 4/10
export function placePayMultiplier(placeNum: number): { pays: number; costs: number } {
  if (placeNum === 6 || placeNum === 8) return { pays: 7, costs: 6 };
  if (placeNum === 5 || placeNum === 9) return { pays: 7, costs: 5 };
  if (placeNum === 4 || placeNum === 10) return { pays: 9, costs: 5 };
  return { pays: 1, costs: 1 };
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
  roundOver: boolean; // true = bets cleared, new round starts
  sevenOut: boolean;
} {
  const sum = diceSum(dice);
  const results: Record<number, CrapsResult> = {};
  let newPoint = point;
  let newPhase: CrapsPhase = phase;
  let description = "";
  let roundOver = false;
  let sevenOut = false;

  // Initialize results for all players
  for (const pid of turnOrder) {
    results[pid] = { result: "", amount: 0 };
  }

  if (phase === "come-out") {
    const outcome = comeOutResult(sum);

    if (outcome === "natural") {
      description = sum === 7 ? "Natural 7!" : "Yo 11!";
      roundOver = true;
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
      // Stay in come-out for next roll (same shooter)
      newPhase = "come-out";
    } else if (outcome === "craps") {
      description = sum === 2 ? "Snake Eyes!" : sum === 3 ? "Ace Deuce!" : "Boxcars!";
      roundOver = true;
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
      // Stay in come-out for next roll (same shooter)
      newPhase = "come-out";
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
      roundOver = true;
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
          } else if (bet.type.startsWith("place")) {
            const placeNum = parseInt(bet.type.replace("place", ""));
            if (sum === placeNum) {
              const { pays, costs } = placePayMultiplier(placeNum);
              const win = Math.floor(bet.amount * pays / costs);
              totalAmount += win;
              parts.push(`Place ${placeNum} +$${win}`);
            }
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPoint = null;
      newPhase = "come-out"; // same shooter continues
    } else if (outcome === "seven-out") {
      description = "Seven out!";
      roundOver = true;
      sevenOut = true;
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
          } else if (bet.type.startsWith("place")) {
            totalAmount -= bet.amount;
            const placeNum = bet.type.replace("place", "");
            parts.push(`Place ${placeNum} -$${bet.amount}`);
          }
        }

        results[pid] = { result: parts.join(", ") || "No bet", amount: totalAmount };
      }
      newPoint = null;
      newPhase = "come-out"; // new shooter
    } else {
      // Continue — resolve field bets and place bets that hit
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
          } else if (bet.type.startsWith("place")) {
            const placeNum = parseInt(bet.type.replace("place", ""));
            if (sum === placeNum) {
              const { pays, costs } = placePayMultiplier(placeNum);
              const win = Math.floor(bet.amount * pays / costs);
              totalAmount += win;
              parts.push(`Place ${placeNum} +$${win}`);
            }
            // Place bets stay active, don't lose unless seven-out
          }
        }

        if (parts.length > 0 || totalAmount !== 0) {
          results[pid] = { result: parts.join(", "), amount: totalAmount };
        }
      }
      // Stay in point phase
      newPhase = "point";
    }
  }

  return { results, newPoint, newPhase, description, roundOver, sevenOut };
}
