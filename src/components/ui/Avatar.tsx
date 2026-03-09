"use client";

import { motion } from "framer-motion";
import { Player } from "@/lib/types";
import PlayerIcon from "./PlayerIcon";

interface AvatarProps {
  player: Player;
  size?: number;
  active?: boolean;
  chips?: number | null;
  showChips?: boolean;
}

export default function Avatar({
  player,
  size = 48,
  active = false,
  chips = null,
  showChips = true,
}: AvatarProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: active
            ? `linear-gradient(135deg, ${player.color}, ${player.color}88)`
            : "#1e1e2e",
          border: `2px solid ${active ? player.color : "#333"}`,
          boxShadow: active ? `0 0 20px ${player.color}44` : "none",
        }}
        animate={active ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <PlayerIcon
          name={player.icon}
          size={size * 0.45}
          color={active ? "#fff" : "#888"}
        />
      </motion.div>
      <span
        className="font-body"
        style={{
          fontSize: 11,
          color: active ? "#fff" : "#888",
          fontWeight: active ? 600 : 400,
        }}
      >
        {player.name}
      </span>
      {showChips && chips !== null && (
        <span className="font-mono text-casino-gold font-semibold" style={{ fontSize: 10 }}>
          ${chips.toLocaleString()}
        </span>
      )}
    </div>
  );
}
