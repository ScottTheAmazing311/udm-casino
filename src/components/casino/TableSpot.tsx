"use client";

import { motion } from "framer-motion";
import { Swords, Spade, Dice5 } from "lucide-react";
import Image from "next/image";
import { CasinoTable, CasinoSeat } from "@/lib/store/casino-store";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";

interface TableSpotProps {
  table: CasinoTable;
  seats: CasinoSeat[];
  playerId: number;
  onlinePlayers: number[];
  onSit: () => void;
  delay?: number;
}

const GAME_ICONS = {
  blackjack: Swords,
  poker: Spade,
  craps: Dice5,
};

const GAME_COLORS = {
  blackjack: "#FF6B6B",
  poker: "#60A5FA",
  craps: "#F59E0B",
};

export default function TableSpot({
  table,
  seats,
  playerId,
  onlinePlayers,
  onSit,
  delay = 0,
}: TableSpotProps) {
  const Icon = GAME_ICONS[table.game_type];
  const color = GAME_COLORS[table.game_type];
  const iAmSeated = seats.some((s) => s.player_id === playerId);
  const seatCount = seats.length;
  const hasOnlinePlayers = seats.some((s) => onlinePlayers.includes(s.player_id));

  return (
    <motion.button
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      onClick={onSit}
      className="relative rounded-xl p-3 text-left cursor-pointer group"
      style={{
        background: iAmSeated
          ? `linear-gradient(135deg, ${color}15, ${color}08)`
          : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        border: `1px solid ${iAmSeated ? color + "44" : hasOnlinePlayers ? color + "22" : "#1a2e1a"}`,
      }}
      whileHover={{ scale: 1.03, borderColor: color + "55" }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Active glow */}
      {hasOnlinePlayers && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            boxShadow: `0 0 20px ${color}22`,
          }}
        />
      )}

      {/* Table icon */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: color + "18" }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[12px] font-semibold truncate">
            {table.table_name}
          </div>
          <div className="text-[#555] text-[9px] font-mono">
            ${table.min_bet}-${table.max_bet}
          </div>
        </div>
      </div>

      {/* Seated player avatars */}
      <div className="flex items-center gap-1">
        {seats.length > 0 ? (
          <>
            <div className="flex -space-x-1.5">
              {seats.slice(0, 4).map((seat) => {
                const isOnline = onlinePlayers.includes(seat.player_id);
                return (
                  <div
                    key={seat.id}
                    className="relative w-5 h-5 rounded-full overflow-hidden border"
                    style={{
                      borderColor: isOnline
                        ? PLAYERS.find((p) => p.id === seat.player_id)?.color || "#666"
                        : "#333",
                    }}
                  >
                    <Image
                      src={HEADSHOTS[seat.player_id] || ""}
                      alt=""
                      width={20}
                      height={20}
                      className="object-cover w-full h-full"
                    />
                    {isOnline && (
                      <div className="absolute -bottom-px -right-px w-1.5 h-1.5 rounded-full bg-casino-green border border-[#0d1a0d]" />
                    )}
                  </div>
                );
              })}
              {seats.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-[#1a1a2e] flex items-center justify-center text-[8px] text-[#666] border border-[#333]">
                  +{seats.length - 4}
                </div>
              )}
            </div>
            <span className="text-[#555] text-[9px] ml-1">
              {seatCount}/{table.max_seats}
            </span>
          </>
        ) : (
          <span className="text-[#3a5a3a] text-[9px] italic">Empty</span>
        )}
      </div>

      {/* "Joined" badge */}
      {iAmSeated && (
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider"
          style={{ background: color + "22", color }}
        >
          Joined
        </div>
      )}
    </motion.button>
  );
}
