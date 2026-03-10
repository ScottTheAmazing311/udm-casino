"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { HEADSHOTS } from "@/lib/headshots";

interface PlayerAvatarProps {
  playerId: number;
  size?: number;
  active?: boolean;
  color?: string;
}

export default function PlayerAvatar({
  playerId,
  size = 48,
  active = false,
  color = "#888",
}: PlayerAvatarProps) {
  const src = HEADSHOTS[playerId];

  return (
    <motion.div
      className="rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: size,
        height: size,
        border: `2px solid ${active ? color : "#333"}`,
        boxShadow: active ? `0 0 16px ${color}33` : "none",
      }}
      animate={active ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {src ? (
        <Image
          src={src}
          alt={`Player ${playerId}`}
          width={size}
          height={size}
          className="object-cover w-full h-full"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-bold"
          style={{ background: color + "33", fontSize: size * 0.4 }}
        >
          ?
        </div>
      )}
    </motion.div>
  );
}
