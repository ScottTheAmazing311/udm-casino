"use client";

import { DICE_DOTS } from "@/lib/constants";

interface DiceProps {
  value: number;
  rolling?: boolean;
  size?: number;
}

export default function Dice({ value, rolling = false, size = 56 }: DiceProps) {
  const dots = DICE_DOTS[value] || [];
  return (
    <div
      className={`relative flex-shrink-0 ${rolling ? "animate-dice-roll" : ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: "linear-gradient(135deg, #f8f5f0, #e8e4df)",
        border: "2px solid rgba(255,255,255,0.2)",
        boxShadow:
          "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
      }}
    >
      {dots.map((pos, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            transform: "translate(-50%, -50%)",
            width: size * 0.16,
            height: size * 0.16,
            background: "#1a1a2e",
          }}
        />
      ))}
    </div>
  );
}
