"use client";

import { motion } from "framer-motion";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";
import { PlayerStats } from "@/lib/store/casino-store";
import { HEADSHOTS } from "@/lib/headshots";

interface LeaderboardProps {
  playerStats: PlayerStats[];
  currentPlayerId: number;
  onClose: () => void;
}

export default function Leaderboard({
  playerStats,
  currentPlayerId,
  onClose,
}: LeaderboardProps) {
  const sorted = [...playerStats].sort((a, b) => b.chips - a.chips);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-t-3xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #111118, #0a0a12)",
          border: "1px solid #222",
          borderBottom: "none",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-xl font-display text-white">Leaderboard</h2>
            <div className="text-[#555] text-[10px]">All-time standings</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <X size={16} className="text-[#666]" />
          </button>
        </div>

        {/* Rankings */}
        <div className="px-4 pb-8 overflow-y-auto" style={{ maxHeight: "calc(80vh - 80px)" }}>
          {sorted.map((player, i) => {
            const rank = i + 1;
            const pnl = player.chips - 1000;
            const winRate =
              player.total_hands_played > 0
                ? Math.round((player.total_wins / player.total_hands_played) * 100)
                : 0;
            const isMe = player.id === currentPlayerId;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-xl p-3 mb-1.5"
                style={{
                  background: isMe ? "rgba(255,215,0,0.06)" : "transparent",
                  border: isMe ? "1px solid rgba(255,215,0,0.12)" : "1px solid transparent",
                }}
              >
                {/* Rank */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono flex-shrink-0"
                  style={{
                    background:
                      rank === 1
                        ? "rgba(255,215,0,0.15)"
                        : rank === 2
                        ? "rgba(192,192,192,0.1)"
                        : rank === 3
                        ? "rgba(205,127,50,0.1)"
                        : "rgba(255,255,255,0.03)",
                    color:
                      rank === 1
                        ? "#FFD700"
                        : rank === 2
                        ? "#C0C0C0"
                        : rank === 3
                        ? "#CD7F32"
                        : "#555",
                  }}
                >
                  {rank}
                </div>

                {/* Avatar */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden border flex-shrink-0"
                  style={{ borderColor: player.is_online ? "#4ADE80" : "#333" }}
                >
                  <Image
                    src={HEADSHOTS[player.id] || ""}
                    alt={player.name}
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                  {player.is_online && (
                    <div className="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-casino-green border border-[#111118]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold truncate">
                    {player.name}
                    {isMe && <span className="text-[#666] text-[9px] ml-1">(you)</span>}
                  </div>
                  <div className="text-[#555] text-[10px]">
                    {player.total_hands_played} hands · {winRate}% win
                  </div>
                </div>

                {/* Chips & P&L */}
                <div className="text-right flex-shrink-0">
                  <div className="text-casino-gold text-sm font-mono font-bold">
                    ${player.chips.toLocaleString()}
                  </div>
                  <div
                    className="text-[10px] font-mono flex items-center justify-end gap-0.5"
                    style={{
                      color: pnl > 0 ? "#4ADE80" : pnl < 0 ? "#FF6B6B" : "#555",
                    }}
                  >
                    {pnl > 0 ? (
                      <TrendingUp size={9} />
                    ) : pnl < 0 ? (
                      <TrendingDown size={9} />
                    ) : (
                      <Minus size={9} />
                    )}
                    {pnl >= 0 ? "+" : ""}${pnl.toLocaleString()}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
