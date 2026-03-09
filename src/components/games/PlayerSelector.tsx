"use client";

import { motion } from "framer-motion";
import { Player, ChipCounts } from "@/lib/types";
import PlayerIcon from "@/components/ui/PlayerIcon";

interface PlayerSelectorProps {
  players: Player[];
  seated: Player[];
  chipCounts: ChipCounts;
  onToggle: (player: Player) => void;
}

export default function PlayerSelector({
  players,
  seated,
  chipCounts,
  onToggle,
}: PlayerSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {players.map((p, i) => {
        const isSat = seated.some((s) => s.id === p.id);
        return (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onToggle(p)}
            className="flex items-center gap-2 rounded-xl px-4 py-3 cursor-pointer"
            style={{
              background: isSat ? `${p.color}22` : "#1a1a2e",
              border: `2px solid ${isSat ? p.color : "#333"}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: isSat ? `${p.color}33` : "#111118",
              }}
            >
              <PlayerIcon
                name={p.icon}
                size={16}
                color={isSat ? p.color : "#666"}
              />
            </div>
            <div className="text-left">
              <div className="text-white text-[13px] font-semibold">{p.name}</div>
              <div className="text-casino-gold text-[11px] font-mono">
                ${chipCounts[p.id].toLocaleString()}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
