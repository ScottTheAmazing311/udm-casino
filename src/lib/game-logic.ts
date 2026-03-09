import { CardType, PokerHandEval } from "./types";
import { SUITS, RANKS } from "./constants";

export function createDeck(numDecks = 1): CardType[] {
  const deck: CardType[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: `${rank}${suit}-${d}-${Math.random()}` });
      }
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(card: CardType): number {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return parseInt(card.rank);
}

export function handValue(cards: CardType[]): number {
  let total = cards.reduce((s, c) => s + cardValue(c), 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function evaluatePokerHand(cards: CardType[]): PokerHandEval {
  if (cards.length < 5) return { rank: 0, name: "Incomplete" };
  const best5 = getBest5(cards);
  return best5 ? rankHand(best5) : { rank: 0, name: "Incomplete" };
}

function getBest5(cards: CardType[]): CardType[] | null {
  if (cards.length === 5) return cards;
  let best: CardType[] | null = null;
  let bestRank = -1;
  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const r = rankHand(combo);
    if (r.rank > bestRank) {
      bestRank = r.rank;
      best = combo;
    }
  }
  return best;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const without = combinations(rest, k);
  return [...withFirst, ...without];
}

function rankHand(cards: CardType[]): PokerHandEval {
  const ranks = cards
    .map((c) => {
      if (c.rank === "A") return 14;
      if (c.rank === "K") return 13;
      if (c.rank === "Q") return 12;
      if (c.rank === "J") return 11;
      return parseInt(c.rank);
    })
    .sort((a, b) => b - a);

  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight =
    (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) ||
    (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2);

  const counts: Record<number, number> = {};
  ranks.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1;
  });
  const groups = Object.entries(counts).sort(
    (a, b) => b[1] - a[1] || parseInt(b[0]) - parseInt(a[0])
  );

  if (isFlush && isStraight && ranks[0] === 14) return { rank: 9, name: "Royal Flush" };
  if (isFlush && isStraight) return { rank: 8, name: "Straight Flush" };
  if (groups[0][1] === 4) return { rank: 7, name: "Four of a Kind" };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 6, name: "Full House" };
  if (isFlush) return { rank: 5, name: "Flush" };
  if (isStraight) return { rank: 4, name: "Straight" };
  if (groups[0][1] === 3) return { rank: 3, name: "Three of a Kind" };
  if (groups[0][1] === 2 && groups[1][1] === 2) return { rank: 2, name: "Two Pair" };
  if (groups[0][1] === 2) return { rank: 1, name: "Pair" };
  return { rank: 0, name: "High Card" };
}
