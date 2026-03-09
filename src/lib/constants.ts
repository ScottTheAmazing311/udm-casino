import { Player } from "./types";

export const PLAYERS: Player[] = [
  { id: 1, name: "Scott", icon: "Target", color: "#FF6B6B" },
  { id: 2, name: "Andre", icon: "Sparkles", color: "#A78BFA" },
  { id: 3, name: "Pat", icon: "Flame", color: "#F59E0B" },
  { id: 4, name: "Chan", icon: "Gem", color: "#34D399" },
  { id: 5, name: "Sky", icon: "Dice5", color: "#60A5FA" },
  { id: 6, name: "Tones", icon: "Moon", color: "#F472B6" },
  { id: 7, name: "Wim", icon: "Zap", color: "#FB923C" },
  { id: 8, name: "Wake", icon: "Clover", color: "#4ADE80" },
  { id: 9, name: "Geoff", icon: "Joystick", color: "#C084FC" },
  { id: 10, name: "Bork", icon: "Star", color: "#FBBF24" },
  { id: 11, name: "Ralph", icon: "CircleDot", color: "#38BDF8" },
  { id: 12, name: "Casper", icon: "Orbit", color: "#FB7185" },
];

export const SUITS = ["♠", "♥", "♦", "♣"] as const;

export const SUIT_COLORS: Record<string, string> = {
  "♠": "#e2e8f0",
  "♥": "#FF6B6B",
  "♦": "#FF6B6B",
  "♣": "#e2e8f0",
};

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};
