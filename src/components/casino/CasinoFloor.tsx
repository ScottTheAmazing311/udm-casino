"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, LogOut, Coins } from "lucide-react";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { useCasinoStore } from "@/lib/store/casino-store";
import { useCasinoFloor } from "@/hooks/useCasinoFloor";
import { usePresence } from "@/hooks/usePresence";
import Image from "next/image";
import TableSpot from "./TableSpot";
import Leaderboard from "./Leaderboard";
import MiniHUD from "./MiniHUD";

interface CasinoFloorProps {
  playerId: number;
  playerName: string;
  onSitDown: (tableId: string) => void;
  onLogout: () => void;
}

export default function CasinoFloor({
  playerId,
  playerName,
  onSitDown,
  onLogout,
}: CasinoFloorProps) {
  const { casinoTables, casinoSeats, playerStats, sitDown } = useCasinoFloor();
  const { showLeaderboard, toggleLeaderboard } = useCasinoStore();
  const { onlinePlayers } = useCasinoStore();
  usePresence(playerId);

  const currentPlayer = PLAYERS.find((p) => p.id === playerId);
  const myChips = playerStats.find((p) => p.id === playerId)?.chips ?? 1000;

  const handleSitDown = async (tableId: string) => {
    const table = casinoTables.find((t) => t.id === tableId);
    if (!table) return;

    // Check if already seated at this table
    const alreadySeated = casinoSeats.some(
      (s) => s.table_id === tableId && s.player_id === playerId
    );

    if (!alreadySeated) {
      const result = await sitDown(tableId, playerId);
      if (result.error) return;
    }

    onSitDown(tableId);
  };

  return (
    <div className="min-h-screen bg-casino-dark relative overflow-hidden">
      {/* Carpet texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #FFD700 0.5px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header bar */}
      <motion.div
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(180deg, #0a0a12 60%, transparent)",
        }}
      >
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 flex-shrink-0"
          style={{ borderColor: currentPlayer?.color || "#666" }}
        >
          <Image
            src={HEADSHOTS[playerId] || ""}
            alt={playerName}
            width={36}
            height={36}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">{playerName}</div>
          <div className="text-casino-gold text-[11px] font-mono flex items-center gap-1">
            <Coins size={10} />
            ${myChips.toLocaleString()}
          </div>
        </div>
        <button
          onClick={toggleLeaderboard}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" }}
        >
          <Trophy size={16} className="text-casino-gold" />
        </button>
        <button
          onClick={onLogout}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #222" }}
        >
          <LogOut size={16} className="text-[#666]" />
        </button>
      </motion.div>

      {/* Casino Title */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center pt-2 pb-6 px-4"
      >
        <div className="text-[10px] tracking-[5px] text-casino-gold uppercase font-semibold mb-1">
          Private Club
        </div>
        <h1 className="text-3xl font-display text-white tracking-tight">
          UDM Casino
        </h1>
        <div className="text-[#444] text-[11px] mt-1">
          {onlinePlayers.length} player{onlinePlayers.length !== 1 ? "s" : ""} online
        </div>
      </motion.div>

      {/* Casino Floor - Isometric Grid */}
      <div className="px-4 pb-8">
        <div
          className="relative mx-auto"
          style={{
            maxWidth: 460,
            perspective: "800px",
          }}
        >
          {/* Floor surface */}
          <motion.div
            initial={{ opacity: 0, rotateX: 10 }}
            animate={{ opacity: 1, rotateX: 0 }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0d1a0d 0%, #0a150a 50%, #0d1a0d 100%)",
              border: "1px solid #1a2e1a",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
              padding: "24px 16px",
            }}
          >
            {/* Carpet pattern */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(45deg, transparent, transparent 8px, #228B22 8px, #228B22 9px),
                  repeating-linear-gradient(-45deg, transparent, transparent 8px, #228B22 8px, #228B22 9px)
                `,
              }}
            />

            {/* Gold border rail */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: "2px solid rgba(255,215,0,0.12)",
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.3)",
              }}
            />

            {/* Tables grid */}
            <div className="relative z-10 flex flex-col gap-6">
              {/* Row 1: Blackjack Tables */}
              <div>
                <div className="text-[#3a5a3a] text-[9px] uppercase tracking-[3px] font-bold mb-3 pl-1">
                  Blackjack
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {casinoTables
                    .filter((t) => t.game_type === "blackjack")
                    .map((table, i) => (
                      <TableSpot
                        key={table.id}
                        table={table}
                        seats={casinoSeats.filter((s) => s.table_id === table.id)}
                        playerId={playerId}
                        onlinePlayers={onlinePlayers}
                        onSit={() => handleSitDown(table.id)}
                        delay={i * 0.1}
                      />
                    ))}
                </div>
              </div>

              {/* Row 2: Poker Tables */}
              <div>
                <div className="text-[#3a5a3a] text-[9px] uppercase tracking-[3px] font-bold mb-3 pl-1">
                  Texas Hold&apos;em
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {casinoTables
                    .filter((t) => t.game_type === "poker")
                    .map((table, i) => (
                      <TableSpot
                        key={table.id}
                        table={table}
                        seats={casinoSeats.filter((s) => s.table_id === table.id)}
                        playerId={playerId}
                        onlinePlayers={onlinePlayers}
                        onSit={() => handleSitDown(table.id)}
                        delay={0.2 + i * 0.1}
                      />
                    ))}
                </div>
              </div>

              {/* Row 3: Craps */}
              <div>
                <div className="text-[#3a5a3a] text-[9px] uppercase tracking-[3px] font-bold mb-3 pl-1">
                  Craps
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {casinoTables
                    .filter((t) => t.game_type === "craps")
                    .map((table, i) => (
                      <TableSpot
                        key={table.id}
                        table={table}
                        seats={casinoSeats.filter((s) => s.table_id === table.id)}
                        playerId={playerId}
                        onlinePlayers={onlinePlayers}
                        onSit={() => handleSitDown(table.id)}
                        delay={0.4 + i * 0.1}
                      />
                    ))}
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#228B22] opacity-20" />
            <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#228B22] opacity-20" />
            <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-[#228B22] opacity-20" />
            <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-[#228B22] opacity-20" />
          </motion.div>
        </div>
      </div>

      {/* Online Players Bar */}
      <MiniHUD
        playerId={playerId}
        onlinePlayers={onlinePlayers}
        playerStats={playerStats}
      />

      {/* Leaderboard Overlay */}
      <AnimatePresence>
        {showLeaderboard && (
          <Leaderboard
            playerStats={playerStats}
            currentPlayerId={playerId}
            onClose={toggleLeaderboard}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
