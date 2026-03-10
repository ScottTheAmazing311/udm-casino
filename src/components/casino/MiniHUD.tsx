"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { PlayerStats } from "@/lib/store/casino-store";

interface MiniHUDProps {
  playerId: number;
  onlinePlayers: number[];
  playerStats: PlayerStats[];
}

export default function MiniHUD({
  playerId,
  onlinePlayers,
  playerStats,
}: MiniHUDProps) {
  const onlineOthers = onlinePlayers.filter((id) => id !== playerId);

  if (onlineOthers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pb-6"
    >
      <div className="max-w-[460px] mx-auto">
        <div className="text-[#444] text-[9px] uppercase tracking-[2px] mb-2 pl-1">
          Online Now
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {onlineOthers.map((pid) => {
            const p = PLAYERS.find((pl) => pl.id === pid);
            const stats = playerStats.find((s) => s.id === pid);
            if (!p) return null;

            return (
              <motion.div
                key={pid}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div
                  className="relative w-9 h-9 rounded-full overflow-hidden border-2"
                  style={{ borderColor: p.color }}
                >
                  <Image
                    src={HEADSHOTS[pid] || ""}
                    alt={p.name}
                    width={36}
                    height={36}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full bg-casino-green border-2 border-casino-dark" />
                </div>
                <span className="text-[#888] text-[9px] font-medium">{p.name}</span>
                {stats && (
                  <span className="text-casino-gold text-[8px] font-mono">
                    ${stats.chips.toLocaleString()}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
