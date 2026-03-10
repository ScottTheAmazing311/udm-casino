"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, LogOut, Coins, HelpCircle } from "lucide-react";
import Image from "next/image";
import { HEADSHOTS } from "@/lib/headshots";
import { PLAYERS } from "@/lib/constants";
import { useCasinoFloor } from "@/hooks/useCasinoFloor";
import { usePresence } from "@/hooks/usePresence";
import { useCasinoStore } from "@/lib/store/casino-store";
import Leaderboard from "./Leaderboard";

interface IsometricFloorProps {
  playerId: number;
  playerName: string;
  onSitDown: (tableId: string) => void;
  onLogout: () => void;
}

// Tap zones mapped to actual table positions in casino.png (percentages of image)
const TAP_ZONES = [
  // Poker — centered around x:72% y:23%
  { id: "poker", gameType: "poker", label: "Poker", top: 17, left: 55, width: 35, height: 12 },
  // Blackjack — around x:26-40% y:40%
  { id: "blackjack", gameType: "blackjack", label: "Blackjack", top: 33, left: 14, width: 38, height: 14 },
  // Slots — left side machines, y:49% down to y:79%
  { id: "slots", gameType: "slots", label: "Slots", top: 49, left: 0, width: 24, height: 30 },
  // Craps — centered around x:74% y:61%
  { id: "craps", gameType: "craps", label: "Craps", top: 54, left: 54, width: 42, height: 14 },
  // Roulette — centered around x:76% y:78%
  { id: "roulette", gameType: "craps", label: "Roulette", top: 71, left: 54, width: 42, height: 14 },
];

const BOUNDS = { minX: 5, maxX: 95, minY: 16, maxY: 92 };

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export default function IsometricFloor({
  playerId,
  playerName,
  onSitDown,
  onLogout,
}: IsometricFloorProps) {
  const [avatarPos, setAvatarPos] = useState({ x: 50, y: 75 });
  const [tablePrompt, setTablePrompt] = useState<{
    gameType: string;
    label: string;
  } | null>(null);
  const [imgSize, setImgSize] = useState({ w: 390, h: 844, x: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStarted = useRef(false);

  const { casinoTables, casinoSeats, playerStats, sitDown } = useCasinoFloor();
  const { showLeaderboard, toggleLeaderboard, onlinePlayers } = useCasinoStore();
  usePresence(playerId);

  const myChips = playerStats.find((p) => p.id === playerId)?.chips ?? 1000;
  const currentPlayer = PLAYERS.find((p) => p.id === playerId);

  // Calculate rendered image size to position avatars correctly
  useEffect(() => {
    function calc() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const imgAspect = 704 / 1520;

      let w: number, h: number, x: number;
      if (vw / vh < imgAspect) {
        // Viewport is taller — image fills width
        w = vw;
        h = vw / imgAspect;
        x = 0;
      } else {
        // Viewport is wider — image fills height
        h = vh;
        w = vh * imgAspect;
        x = (vw - w) / 2;
      }
      setImgSize({ w, h, x });
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Background music
  useEffect(() => {
    const audio = new Audio("/pixel-jackpot.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  function startMusic() {
    if (!audioStarted.current && audioRef.current) {
      audioRef.current.play().catch(() => {});
      audioStarted.current = true;
    }
  }

  function handleFloorTap(e: React.MouseEvent<HTMLDivElement>) {
    startMusic();
    // Get tap position relative to the image container
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Check game zone taps
    for (const zone of TAP_ZONES) {
      if (
        xPct >= zone.left &&
        xPct <= zone.left + zone.width &&
        yPct >= zone.top &&
        yPct <= zone.top + zone.height
      ) {
        setAvatarPos({
          x: clamp(zone.left + zone.width / 2, BOUNDS.minX, BOUNDS.maxX),
          y: clamp(zone.top + zone.height + 4, BOUNDS.minY, BOUNDS.maxY),
        });
        setTablePrompt({ gameType: zone.gameType, label: zone.label });
        return;
      }
    }

    // Walk to tap position
    setTablePrompt(null);
    setAvatarPos({
      x: clamp(xPct, BOUNDS.minX, BOUNDS.maxX),
      y: clamp(yPct, BOUNDS.minY, BOUNDS.maxY),
    });
  }

  async function handleSitDown() {
    if (!tablePrompt) return;
    const table = casinoTables.find((t) => t.game_type === tablePrompt.gameType);
    if (!table) return;

    const alreadySeated = casinoSeats.some(
      (s) => s.table_id === table.id && s.player_id === playerId
    );

    if (!alreadySeated) {
      const result = await sitDown(table.id, playerId);
      if (result.error) return;
    }

    setTablePrompt(null);
    onSitDown(table.id);
  }

  function seatedCount(gameType: string) {
    const table = casinoTables.find((t) => t.game_type === gameType);
    if (!table) return 0;
    return casinoSeats.filter((s) => s.table_id === table.id).length;
  }

  return (
    <div className="relative w-full h-screen bg-[#060610] overflow-hidden">
      {/*
        Image container — sized and positioned to exactly match where
        object-contain renders the image. Avatars and tap zones are
        children so their percentages align with the image pixels.
      */}
      <div
        ref={containerRef}
        className="absolute top-0 overflow-hidden"
        style={{
          left: imgSize.x,
          width: imgSize.w,
          height: imgSize.h,
        }}
        onClick={handleFloorTap}
      >
        {/* Casino floor image fills this container exactly */}
        <Image
          src="/casino-floor.png"
          alt="Casino Floor"
          fill
          className="object-fill pointer-events-none"
          style={{ imageRendering: "pixelated" }}
          priority
        />

        {/* My avatar */}
        <motion.div
          className="absolute z-10 flex flex-col items-center pointer-events-none"
          animate={{ left: `${avatarPos.x}%`, top: `${avatarPos.y}%` }}
          transition={{ type: "tween", duration: 0.6, ease: "easeInOut" }}
          style={{ transform: "translate(-50%, -100%)" }}
        >
          <div
            className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-8 h-2 rounded-full"
            style={{ background: "rgba(0,0,0,0.5)", filter: "blur(2px)" }}
          />
          <div
            className="w-10 h-10 rounded-full overflow-hidden border-2 shadow-lg shadow-black/60"
            style={{ borderColor: currentPlayer?.color || "#FFD700" }}
          >
            <Image
              src={HEADSHOTS[playerId] || ""}
              alt={playerName}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          </div>
          <div
            className="mt-0.5 px-2 py-0.5 rounded-full text-[8px] font-bold text-white whitespace-nowrap"
            style={{ background: "rgba(0,0,0,0.75)" }}
          >
            {playerName}
          </div>
        </motion.div>

        {/* Other online players */}
        {onlinePlayers
          .filter((pid) => pid !== playerId)
          .map((pid, i) => {
            const p = PLAYERS.find((pl) => pl.id === pid);
            if (!p) return null;

            // Check if player is seated at a table
            const seat = casinoSeats.find((s) => s.player_id === pid);
            const seatedTable = seat
              ? casinoTables.find((t) => t.id === seat.table_id)
              : null;
            const seatedZone = seatedTable
              ? TAP_ZONES.find((z) => z.gameType === seatedTable.game_type)
              : null;

            // Position near table if seated, otherwise spread around the floor
            const idlePositions = [
              { x: 25, y: 85 },
              { x: 70, y: 85 },
              { x: 45, y: 88 },
              { x: 60, y: 82 },
              { x: 35, y: 80 },
              { x: 80, y: 88 },
              { x: 15, y: 82 },
              { x: 50, y: 85 },
            ];
            const pos = seatedZone
              ? {
                  x: clamp(seatedZone.left + seatedZone.width / 2 + (i % 2 === 0 ? -6 : 6), BOUNDS.minX, BOUNDS.maxX),
                  y: clamp(seatedZone.top + seatedZone.height + 6, BOUNDS.minY, BOUNDS.maxY),
                }
              : idlePositions[i % idlePositions.length];

            const gameLabel = seatedTable
              ? seatedTable.game_type.charAt(0).toUpperCase() + seatedTable.game_type.slice(1)
              : null;

            return (
              <div
                key={pid}
                className="absolute z-10 flex flex-col items-center pointer-events-none"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-full overflow-hidden border-2 shadow-md shadow-black/40"
                  style={{ borderColor: seatedTable ? "#34D399" : p.color }}
                >
                  <Image
                    src={HEADSHOTS[pid] || ""}
                    alt={p.name}
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div
                  className="mt-0.5 px-1.5 py-px rounded-full text-[7px] font-medium text-white/80 whitespace-nowrap"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                >
                  {p.name}
                </div>
                {gameLabel && (
                  <div
                    className="mt-0.5 px-1.5 py-px rounded-full text-[6px] font-bold whitespace-nowrap"
                    style={{ background: "rgba(52,211,153,0.2)", color: "#34D399" }}
                  >
                    Playing {gameLabel}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* HUD — Top Bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-3 py-2 flex items-center gap-2"
        style={{ background: "linear-gradient(180deg, rgba(6,6,16,0.9) 50%, transparent)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-8 h-8 rounded-full overflow-hidden border-2 flex-shrink-0"
          style={{ borderColor: currentPlayer?.color || "#666" }}
        >
          <Image
            src={HEADSHOTS[playerId] || ""}
            alt={playerName}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-semibold truncate">{playerName}</div>
          <div className="text-casino-gold text-[10px] font-mono flex items-center gap-1">
            <Coins size={9} />
            ${myChips.toLocaleString()}
          </div>
        </div>
        <div className="text-[#555] text-[9px]">
          {onlinePlayers.length} online
        </div>
        <button
          onClick={toggleLeaderboard}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,215,0,0.08)" }}
        >
          <Trophy size={14} className="text-casino-gold" />
        </button>
        <button
          onClick={onLogout}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <LogOut size={14} className="text-[#555]" />
        </button>
      </div>

      {/* Table Sit Prompt */}
      <AnimatePresence>
        {tablePrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute bottom-6 left-4 right-4 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,215,0,0.1)" }}
              >
                <HelpCircle size={20} className="text-casino-gold" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-semibold">
                  {tablePrompt.label}
                </div>
                <div className="text-[#666] text-[10px]">
                  {tablePrompt.gameType === "blackjack"
                    ? `${seatedCount(tablePrompt.gameType)} players seated`
                    : "Coming Soon"}
                </div>
              </div>
              {tablePrompt.gameType === "blackjack" ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSitDown}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: "linear-gradient(135deg, #FFD700, #FFA500)",
                    color: "#000",
                  }}
                >
                  Sit Down
                </motion.button>
              ) : (
                <div
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#666]"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  Coming Soon
                </div>
              )}
              <button
                onClick={() => setTablePrompt(null)}
                className="text-[#555] text-xs px-2"
              >
                &times;
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
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
