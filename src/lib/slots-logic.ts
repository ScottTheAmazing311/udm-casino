// Slot machine symbols and logic

export const SLOT_SYMBOLS = [
  { id: "cherry", img: "/slots/cherry.png", name: "Cherry" },
  { id: "lemon", img: "/slots/lemon.png", name: "Lemon" },
  { id: "orange", img: "/slots/orange.png", name: "Orange" },
  { id: "plum", img: "/slots/plum.png", name: "Plum" },
  { id: "bell", img: "/slots/bell.png", name: "Bell" },
  { id: "bar", img: "/slots/bar.png", name: "Bar" },
  { id: "seven", img: "/slots/seven.png", name: "Seven" },
  { id: "diamond", img: "/slots/diamond.png", name: "Diamond" },
  { id: "grapes", img: "/slots/grapes.png", name: "Grapes" },
  { id: "melon", img: "/slots/melon.png", name: "Melon" },
  { id: "coin", img: "/slots/coin.png", name: "Coin" },
  { id: "apple", img: "/slots/apple.png", name: "Apple" },
] as const;

export type SlotSymbolId = (typeof SLOT_SYMBOLS)[number]["id"];

// Each reel has a fixed strip of symbols that it cycles through
// This determines the order symbols appear when spinning
export const REEL_STRIPS: SlotSymbolId[][] = [
  ["cherry", "lemon", "bar", "orange", "plum", "seven", "bell", "grapes", "diamond", "melon", "coin", "apple"],
  ["bell", "orange", "cherry", "diamond", "lemon", "plum", "apple", "bar", "melon", "seven", "grapes", "coin"],
  ["plum", "seven", "melon", "cherry", "coin", "bell", "lemon", "diamond", "orange", "apple", "bar", "grapes"],
];

// Weighted reel strips for random result generation (server-side)
// 20-symbol strip → ~89% RTP (player-friendly for a friends game)
const REEL_STRIP: SlotSymbolId[] = [
  "cherry", "cherry", "cherry", "cherry",
  "lemon", "lemon", "lemon",
  "orange", "orange",
  "plum", "plum",
  "apple", "apple",
  "grapes",
  "bell",
  "melon",
  "coin",
  "bar",
  "seven",
  "diamond",
];

// Payouts for 3 matching symbols (multiplier on bet)
const PAYOUTS: Record<SlotSymbolId, number> = {
  cherry: 5,
  lemon: 8,
  orange: 15,
  plum: 15,
  apple: 15,
  grapes: 25,
  bell: 25,
  melon: 40,
  coin: 40,
  bar: 75,
  seven: 150,
  diamond: 500,
};

// 2 matching (first two) pays reduced
const TWO_MATCH_PAYOUTS: Record<SlotSymbolId, number> = {
  cherry: 2,
  lemon: 3,
  orange: 5,
  plum: 5,
  apple: 5,
  grapes: 10,
  bell: 10,
  melon: 15,
  coin: 15,
  bar: 25,
  seven: 50,
  diamond: 50,
};

export interface SpinResult {
  reels: [SlotSymbolId, SlotSymbolId, SlotSymbolId];
  multiplier: number;
  winType: "jackpot" | "three" | "two" | "none";
  winDescription: string;
}

export function spin(): SpinResult {
  const reels: [SlotSymbolId, SlotSymbolId, SlotSymbolId] = [
    REEL_STRIP[Math.floor(Math.random() * REEL_STRIP.length)],
    REEL_STRIP[Math.floor(Math.random() * REEL_STRIP.length)],
    REEL_STRIP[Math.floor(Math.random() * REEL_STRIP.length)],
  ];

  const sym = (id: SlotSymbolId) => SLOT_SYMBOLS.find((s) => s.id === id)!;

  // Three of a kind
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const mult = PAYOUTS[reels[0]];
    const isJackpot = reels[0] === "diamond";
    return {
      reels,
      multiplier: mult,
      winType: isJackpot ? "jackpot" : "three",
      winDescription: isJackpot
        ? `JACKPOT! Triple ${sym(reels[0]).name}!`
        : `Triple ${sym(reels[0]).name}! ${mult}x`,
    };
  }

  // Two matching (first two reels)
  if (reels[0] === reels[1]) {
    const mult = TWO_MATCH_PAYOUTS[reels[0]];
    return {
      reels,
      multiplier: mult,
      winType: "two",
      winDescription: `Double ${sym(reels[0]).name}! ${mult}x`,
    };
  }

  return {
    reels,
    multiplier: 0,
    winType: "none",
    winDescription: "No win",
  };
}

export function getSymbol(id: SlotSymbolId) {
  return SLOT_SYMBOLS.find((s) => s.id === id)!;
}

// Get the index of a symbol in a reel strip
export function getSymbolIndex(reelIndex: number, symbolId: SlotSymbolId): number {
  return REEL_STRIPS[reelIndex].indexOf(symbolId);
}
