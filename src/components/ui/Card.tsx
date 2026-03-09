"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { CardType } from "@/lib/types";

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  small?: boolean;
  delay?: number;
}

// Map suit symbols to filename letters
const SUIT_MAP: Record<string, string> = {
  "♠": "S",
  "♥": "H",
  "♦": "D",
  "♣": "C",
};

function getCardImagePath(card: CardType): string {
  const suit = SUIT_MAP[card.suit] || "S";
  const rank = card.rank === "10" ? "10" : card.rank;
  return `/cards/${rank}${suit}.png`;
}

export default function Card({ card, faceDown = false, small = false, delay = 0 }: CardProps) {
  const w = small ? 48 : 64;
  const h = small ? 68 : 90;
  const suitSize = small ? 12 : 16;

  if (faceDown) {
    return (
      <motion.div
        initial={{ y: -20, opacity: 0, rotateY: 180 }}
        animate={{ y: 0, opacity: 1, rotateY: 0 }}
        transition={{ duration: 0.4, delay, ease: "easeOut" as const }}
        className="card-back-pattern flex-shrink-0 flex items-center justify-center"
        style={{
          width: w,
          height: h,
          borderRadius: 10,
          background: "linear-gradient(135deg, #1a1a2e 25%, #16213e 50%, #1a1a2e 75%)",
          border: "2px solid #333",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div className="w-[60%] h-[60%] rounded-md border border-white/10 flex items-center justify-center">
          <svg width={suitSize} height={suitSize} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2">
            <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" />
          </svg>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" as const }}
      className="flex-shrink-0 relative overflow-hidden"
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      <Image
        src={getCardImagePath(card)}
        alt={`${card.rank}${card.suit}`}
        fill
        className="object-cover"
        sizes={`${w}px`}
      />
      {/* Subtle shine overlay */}
      <div className="absolute inset-0 card-shine pointer-events-none" />
    </motion.div>
  );
}
