// Basic strategy lookup tables
// Rows: player hand value, Columns: dealer upcard (2-11)
// H=Hit, S=Stand, D=Double, SP=Split

type Action = "H" | "S" | "D" | "SP";

// Hard totals: index by hand value (5-21), dealer upcard (2-11)
const HARD_STRATEGY: Record<number, Action[]> = {
  // val: [2, 3, 4, 5, 6, 7, 8, 9, 10, A]
  5:  ["H","H","H","H","H","H","H","H","H","H"],
  6:  ["H","H","H","H","H","H","H","H","H","H"],
  7:  ["H","H","H","H","H","H","H","H","H","H"],
  8:  ["H","H","H","H","H","H","H","H","H","H"],
  9:  ["H","D","D","D","D","H","H","H","H","H"],
  10: ["D","D","D","D","D","D","D","D","H","H"],
  11: ["D","D","D","D","D","D","D","D","D","D"],
  12: ["H","H","S","S","S","H","H","H","H","H"],
  13: ["S","S","S","S","S","H","H","H","H","H"],
  14: ["S","S","S","S","S","H","H","H","H","H"],
  15: ["S","S","S","S","S","H","H","H","H","H"],
  16: ["S","S","S","S","S","H","H","H","H","H"],
  17: ["S","S","S","S","S","S","S","S","S","S"],
  18: ["S","S","S","S","S","S","S","S","S","S"],
  19: ["S","S","S","S","S","S","S","S","S","S"],
  20: ["S","S","S","S","S","S","S","S","S","S"],
  21: ["S","S","S","S","S","S","S","S","S","S"],
};

// Soft totals: index by hand value (13-21), dealer upcard (2-11)
const SOFT_STRATEGY: Record<number, Action[]> = {
  13: ["H","H","H","D","D","H","H","H","H","H"],
  14: ["H","H","H","D","D","H","H","H","H","H"],
  15: ["H","H","D","D","D","H","H","H","H","H"],
  16: ["H","H","D","D","D","H","H","H","H","H"],
  17: ["H","D","D","D","D","H","H","H","H","H"],
  18: ["D","D","D","D","D","S","S","H","H","H"],
  19: ["S","S","S","S","D","S","S","S","S","S"],
  20: ["S","S","S","S","S","S","S","S","S","S"],
  21: ["S","S","S","S","S","S","S","S","S","S"],
};

// Pair splits: index by card value (2-11), dealer upcard (2-11)
const PAIR_STRATEGY: Record<number, Action[]> = {
  2:  ["SP","SP","SP","SP","SP","SP","H","H","H","H"],
  3:  ["SP","SP","SP","SP","SP","SP","H","H","H","H"],
  4:  ["H","H","H","SP","SP","H","H","H","H","H"],
  5:  ["D","D","D","D","D","D","D","D","H","H"],
  6:  ["SP","SP","SP","SP","SP","H","H","H","H","H"],
  7:  ["SP","SP","SP","SP","SP","SP","H","H","H","H"],
  8:  ["SP","SP","SP","SP","SP","SP","SP","SP","SP","SP"],
  9:  ["SP","SP","SP","SP","SP","S","SP","SP","S","S"],
  10: ["S","S","S","S","S","S","S","S","S","S"],
  11: ["SP","SP","SP","SP","SP","SP","SP","SP","SP","SP"],
};

function cardNumericValue(rank: string): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

function isSoft(cards: { rank: string }[]): boolean {
  const hasAce = cards.some(c => c.rank === "A");
  if (!hasAce) return false;
  const total = cards.reduce((s, c) => s + cardNumericValue(c.rank), 0);
  return total <= 21;
}

function isPair(cards: { rank: string }[]): boolean {
  return cards.length === 2 && cardNumericValue(cards[0].rank) === cardNumericValue(cards[1].rank);
}

export interface StrategyAdvice {
  action: Action;
  actionName: string;
  explanation: string;
  confidence: string;
}

const ACTION_NAMES: Record<Action, string> = {
  H: "Hit",
  S: "Stand",
  D: "Double Down",
  SP: "Split",
};

export function getOptimalPlay(
  playerCards: { rank: string }[],
  dealerUpcard: { rank: string },
): StrategyAdvice {
  const dealerVal = cardNumericValue(dealerUpcard.rank);
  const colIdx = dealerVal - 2; // 2->0, 3->1, ..., 11(A)->9

  const playerVal = playerCards.reduce((s, c) => s + cardNumericValue(c.rank), 0);

  // Adjust for aces
  let adjustedVal = playerVal;
  let aces = playerCards.filter(c => c.rank === "A").length;
  while (adjustedVal > 21 && aces > 0) { adjustedVal -= 10; aces--; }

  let action: Action;

  if (isPair(playerCards)) {
    const pairVal = cardNumericValue(playerCards[0].rank);
    const row = PAIR_STRATEGY[pairVal];
    if (row) {
      action = row[colIdx];
      // pair strategy
    } else {
      action = adjustedVal >= 17 ? "S" : "H";
      // hard strategy
    }
  } else if (isSoft(playerCards) && adjustedVal <= 21) {
    const row = SOFT_STRATEGY[adjustedVal];
    if (row) {
      action = row[colIdx];
      // soft strategy
    } else {
      action = adjustedVal >= 17 ? "S" : "H";
      // soft strategy
    }
  } else {
    const lookupVal = Math.min(Math.max(adjustedVal, 5), 21);
    const row = HARD_STRATEGY[lookupVal];
    if (row) {
      action = row[colIdx];
      // hard strategy
    } else {
      action = adjustedVal >= 17 ? "S" : "H";
      // hard strategy
    }
  }

  // Can't double after initial deal
  if (action === "D" && playerCards.length > 2) {
    action = "H";
  }

  // Can't split non-pairs
  if (action === "SP" && !isPair(playerCards)) {
    action = "H";
  }

  const explanation = getExplanation(action, adjustedVal, dealerVal);
  const confidence = getConfidence(action, adjustedVal, dealerVal);

  return {
    action,
    actionName: ACTION_NAMES[action],
    explanation,
    confidence,
  };
}

function getExplanation(action: Action, playerVal: number, dealerVal: number): string {
  const dealerStr = dealerVal === 11 ? "an Ace" : `a ${dealerVal}`;

  if (action === "SP") {
    if (playerVal === 16) return `Always split 8s. Never play a hard 16 if you can avoid it.`;
    if (playerVal === 22) return `Always split Aces. Two chances at 21 beats a soft 12.`;
    return `Splitting here gives you better expected value against ${dealerStr}.`;
  }

  if (action === "D") {
    if (playerVal === 11) return `11 is the best double-down hand. You're likely to hit 21.`;
    if (playerVal === 10) return `Strong double opportunity. Dealer showing ${dealerStr} is vulnerable.`;
    return `Double down here. The math favors increasing your bet against ${dealerStr}.`;
  }

  if (action === "S") {
    if (playerVal >= 17) return `Stand on ${playerVal}. Don't risk busting a made hand.`;
    if (dealerVal >= 2 && dealerVal <= 6) return `Dealer shows ${dealerStr} — that's a bust card. Let them bust.`;
    return `Stand here. The risk of busting outweighs the potential gain.`;
  }

  // Hit
  if (playerVal <= 11) return `Can't bust — always hit on ${playerVal}.`;
  if (dealerVal >= 7) return `Dealer shows ${dealerStr} — they're likely to make 17+. You need to improve.`;
  return `Hit here. Your ${playerVal} isn't strong enough against ${dealerStr}.`;
}

function getConfidence(action: Action, playerVal: number, dealerVal: number): string {
  // Some plays are more clear-cut than others
  if (action === "S" && playerVal >= 17) return "Very High";
  if (action === "H" && playerVal <= 11) return "Very High";
  if (action === "SP" && (playerVal === 16 || playerVal === 22)) return "Very High";
  if (action === "D" && playerVal === 11) return "Very High";
  if (playerVal >= 12 && playerVal <= 16 && dealerVal >= 7) return "High";
  if (playerVal >= 12 && playerVal <= 16 && dealerVal <= 6) return "High";
  return "Medium";
}

// Colby's personality - casual, knowledgeable, encouraging
export function getColbyTip(advice: StrategyAdvice, playerVal: number): string {
  const tips = [
    `I'd ${advice.actionName.toLowerCase()} here. ${advice.explanation}`,
    `${advice.actionName}. ${advice.explanation} Confidence: ${advice.confidence}.`,
    `The play is ${advice.actionName.toLowerCase()}. ${advice.explanation}`,
  ];

  const extras = [];
  if (advice.confidence === "Very High") {
    extras.push("This one's textbook — don't overthink it.");
    extras.push("No debate on this one.");
  }
  if (advice.confidence === "Medium") {
    extras.push("This is one of the closer calls in basic strategy.");
    extras.push("Tricky spot, but trust the math.");
  }
  if (playerVal === 16) {
    extras.push("16 is the worst hand in blackjack. No good options, just the least bad one.");
  }

  const base = tips[Math.floor(Math.random() * tips.length)];
  const extra = extras.length > 0 ? " " + extras[Math.floor(Math.random() * extras.length)] : "";
  return base + extra;
}
