"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, LogOut, Coins, HelpCircle, DollarSign, Wine } from "lucide-react";
import Image from "next/image";
import { HEADSHOTS } from "@/lib/headshots";
import { PLAYERS } from "@/lib/constants";
import { useCasinoFloor } from "@/hooks/useCasinoFloor";
import { usePresence } from "@/hooks/usePresence";
import { useCasinoStore } from "@/lib/store/casino-store";
import { supabase } from "@/lib/supabase";
import Leaderboard from "./Leaderboard";
import ChatSidebar from "./ChatSidebar";
import MusicButton from "@/components/ui/MusicButton";

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
  { id: "roulette", gameType: "roulette", label: "Roulette", top: 71, left: 54, width: 42, height: 14 },
  // Bar — top left area
  { id: "bar", gameType: "bar", label: "The Bar", top: 30, left: 60, width: 30, height: 12 },
  // Make Money — bottom right corner below roulette
  { id: "makemoney", gameType: "makemoney", label: "Make Money", top: 85, left: 15, width: 40, height: 14 },
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

  const { casinoTables, casinoSeats, playerStats, sitDown } = useCasinoFloor();
  const { showLeaderboard, toggleLeaderboard, onlinePlayers, playMusic } = useCasinoStore();
  const { goOffline } = usePresence(playerId);

  const myChips = playerStats.find((p) => p.id === playerId)?.chips ?? 1000;
  const currentPlayer = PLAYERS.find((p) => p.id === playerId);

  // Make Money feature
  const [moneyPrompt, setMoneyPrompt] = useState<"confirm" | "loading" | "done" | null>(null);
  const [moneyTimer, setMoneyTimer] = useState(30);
  const [moneyPayout, setMoneyPayout] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const moneyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  const COOLDOWN_KEY = `makemoney-cooldown-${playerId}`;

  // Check cooldown on mount and periodically
  useEffect(() => {
    function checkCooldown() {
      const lastUsed = localStorage.getItem(COOLDOWN_KEY);
      if (lastUsed) {
        const elapsed = Date.now() - Number(lastUsed);
        if (elapsed < COOLDOWN_MS) {
          setCooldownRemaining(Math.ceil((COOLDOWN_MS - elapsed) / 1000));
        } else {
          setCooldownRemaining(0);
        }
      }
    }
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [COOLDOWN_KEY, COOLDOWN_MS]);

  function handleMakeMoneyTap() {
    if (cooldownRemaining > 0) {
      setMoneyPrompt("confirm"); // will show cooldown message
      return;
    }
    setMoneyPrompt("confirm");
  }

  function startMakeMoney() {
    setMoneyPrompt("loading");
    setMoneyTimer(30);

    moneyTimerRef.current = setInterval(() => {
      setMoneyTimer((prev) => {
        if (prev <= 1) {
          if (moneyTimerRef.current) clearInterval(moneyTimerRef.current);
          // Calculate payout
          const payout = Math.floor(Math.random() * 176) + 25; // 25-200
          setMoneyPayout(payout);
          // Award chips
          supabase.rpc("update_player_chips", {
            p_player_id: playerId,
            p_amount: payout,
          });
          // Set cooldown
          localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
          setCooldownRemaining(COOLDOWN_MS / 1000);
          setMoneyPrompt("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function closeMakeMoney() {
    setMoneyPrompt(null);
    if (moneyTimerRef.current) clearInterval(moneyTimerRef.current);
  }

  // Bar feature
  const [barPrompt, setBarPrompt] = useState<"menu" | "drinking" | null>(null);
  const [barTimer, setBarTimer] = useState(30);
  const barTimerRef = useRef<NodeJS.Timeout | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  const barAnimRef = useRef<number | null>(null);

  const DRINKS = [
    { name: "Whiskey Sour", emoji: "🥃", color: "#D97706" },
    { name: "Martini", emoji: "🍸", color: "#60A5FA" },
    { name: "Champagne", emoji: "🥂", color: "#FFD700" },
    { name: "Negroni", emoji: "🍹", color: "#EF4444" },
    { name: "Old Fashioned", emoji: "🥃", color: "#B45309" },
    { name: "Mojito", emoji: "🍸", color: "#34D399" },
  ];

  const [selectedDrink, setSelectedDrink] = useState(DRINKS[0]);

  function handleBarTap() {
    setBarPrompt("menu");
  }

  async function orderDrink(drink: typeof DRINKS[0]) {
    setSelectedDrink(drink);
    // Deduct $1
    await supabase.rpc("update_player_chips", {
      p_player_id: playerId,
      p_amount: -1,
    });
    setBarPrompt("drinking");
    setBarTimer(30);
    playMusic("/Low Stakes, High Roll.mp3");

    barTimerRef.current = setInterval(() => {
      setBarTimer((prev) => {
        if (prev <= 1) {
          if (barTimerRef.current) clearInterval(barTimerRef.current);
          closeBar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Vegas music visualizer animation
  useEffect(() => {
    if (barPrompt !== "drinking" || !barCanvasRef.current) return;

    const canvas = barCanvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const bars = 32;
    const barWidth = W / bars;
    const heights = new Array(bars).fill(0);

    // Vegas neon colors
    const neonColors = [
      "#FF1493", "#FFD700", "#00FF88", "#FF4500",
      "#00BFFF", "#FF69B4", "#ADFF2F", "#FF6347",
      "#7B68EE", "#FFD700", "#00CED1", "#FF1493",
    ];

    function animate() {
      ctx.clearRect(0, 0, W, H);

      // Dark bg with stars
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, W, H);

      // Twinkling stars
      for (let i = 0; i < 20; i++) {
        const sx = (Math.sin(Date.now() * 0.001 + i * 7) + 1) / 2 * W;
        const sy = (Math.cos(Date.now() * 0.0008 + i * 5) + 1) / 2 * (H * 0.3);
        const size = Math.sin(Date.now() * 0.003 + i) * 1 + 1.5;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(Date.now() * 0.005 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated bars
      for (let i = 0; i < bars; i++) {
        const target = (Math.sin(Date.now() * 0.003 + i * 0.5) + 1) / 2 * 0.6 +
                       (Math.sin(Date.now() * 0.007 + i * 1.2) + 1) / 2 * 0.3 +
                       Math.random() * 0.1;
        heights[i] += (target * H * 0.7 - heights[i]) * 0.15;

        const gradient = ctx.createLinearGradient(0, H, 0, H - heights[i]);
        const col = neonColors[i % neonColors.length];
        gradient.addColorStop(0, col);
        gradient.addColorStop(0.5, col + "cc");
        gradient.addColorStop(1, col + "44");

        ctx.fillStyle = gradient;
        ctx.shadowBlur = 8;
        ctx.shadowColor = col;
        ctx.fillRect(i * barWidth + 1, H - heights[i], barWidth - 2, heights[i]);

        // Glow top
        ctx.fillStyle = col;
        ctx.shadowBlur = 15;
        ctx.shadowColor = col;
        ctx.fillRect(i * barWidth + 1, H - heights[i], barWidth - 2, 3);
      }
      ctx.shadowBlur = 0;

      // "VEGAS" text shimmer
      const shimmer = Math.sin(Date.now() * 0.004) * 0.3 + 0.7;
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,215,0,${shimmer})`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#FFD700";
      ctx.fillText("★ VEGAS VIBES ★", W / 2, 30);
      ctx.shadowBlur = 0;

      // Drink emoji floating
      ctx.font = "28px serif";
      const emojiY = H * 0.35 + Math.sin(Date.now() * 0.003) * 10;
      ctx.fillText(selectedDrink.emoji, W / 2, emojiY);

      barAnimRef.current = requestAnimationFrame(animate);
    }

    barAnimRef.current = requestAnimationFrame(animate);

    return () => {
      if (barAnimRef.current) cancelAnimationFrame(barAnimRef.current);
    };
  }, [barPrompt, selectedDrink.emoji]);

  function closeBar() {
    setBarPrompt(null);
    if (barTimerRef.current) clearInterval(barTimerRef.current);
    if (barAnimRef.current) cancelAnimationFrame(barAnimRef.current);
    playMusic("/pixel-jackpot.mp3");
  }

  // AFK idle detection
  const [showAfkPrompt, setShowAfkPrompt] = useState(false);
  const [isAfk, setIsAfk] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const afkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afkCountdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (isAfk) return; // Don't reset if already AFK
    lastActivityRef.current = Date.now();
    setShowAfkPrompt(false);
    if (afkTimerRef.current) clearTimeout(afkTimerRef.current);
    if (afkCountdownRef.current) clearTimeout(afkCountdownRef.current);

    afkTimerRef.current = setTimeout(() => {
      setShowAfkPrompt(true);
      // 30s countdown to go AFK
      afkCountdownRef.current = setTimeout(() => {
        setShowAfkPrompt(false);
        setIsAfk(true);
        goOffline();
      }, 30000);
    }, 90000);
  }, [isAfk, goOffline]);

  const handleAfkReturn = useCallback(() => {
    setIsAfk(false);
    setShowAfkPrompt(false);
    if (afkCountdownRef.current) clearTimeout(afkCountdownRef.current);
    // Re-mark online
    supabase
      .from("udm_players")
      .update({ is_online: true, last_seen_at: new Date().toISOString() })
      .eq("id", playerId)
      .then();
    // Restart idle timer
    lastActivityRef.current = Date.now();
    afkTimerRef.current = setTimeout(() => {
      setShowAfkPrompt(true);
      afkCountdownRef.current = setTimeout(() => {
        setShowAfkPrompt(false);
        setIsAfk(true);
        goOffline();
      }, 30000);
    }, 90000);
  }, [playerId, goOffline]);

  // Start idle timer on mount
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (afkTimerRef.current) clearTimeout(afkTimerRef.current);
      if (afkCountdownRef.current) clearTimeout(afkCountdownRef.current);
    };
  }, [resetIdleTimer]);

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

  function startMusic() {
    playMusic("/pixel-jackpot.mp3");
  }

  function handleFloorTap(e: React.MouseEvent<HTMLDivElement>) {
    startMusic();
    resetIdleTimer();
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
        if (zone.gameType === "makemoney") {
          handleMakeMoneyTap();
          return;
        }
        if (zone.gameType === "bar") {
          handleBarTap();
          return;
        }
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

        {/* Bar label */}
        <div
          className="absolute z-10 pointer-events-none flex flex-col items-center"
          style={{
            left: "39%",
            top: "57%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="px-2 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap"
            style={{ background: "rgba(168,85,247,0.2)", color: "#C084FC" }}
          >
            <Wine size={8} className="inline -mt-px" /> The Bar  · $1
          </div>
        </div>

        {/* Make Money character */}
        <div
          className="absolute z-10 pointer-events-none flex flex-col items-center"
          style={{
            left: "32%",
            top: "88%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Image
            src="/makemoney.png"
            alt="Make Money"
            width={50}
            height={70}
            className="drop-shadow-lg"
            style={{ imageRendering: "auto" }}
          />
          <div
            className="mt-0.5 px-2 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap"
            style={{ background: "rgba(255,215,0,0.2)", color: "#FFD700" }}
          >
            <DollarSign size={8} className="inline -mt-px" /> Make Money
          </div>
        </div>
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
        <MusicButton />
        <button
          onClick={onLogout}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <LogOut size={14} className="text-[#555]" />
        </button>
      </div>

      {/* Table Sit Prompt — centered modal */}
      <AnimatePresence>
        {tablePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => { e.stopPropagation(); setTablePrompt(null); }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="rounded-2xl p-6 text-center max-w-xs w-full mx-4"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(255,215,0,0.1)" }}
              >
                <HelpCircle size={28} className="text-casino-gold" />
              </div>
              <div className="text-white text-lg font-bold mb-1">
                {tablePrompt.label}
              </div>
              <div className="text-[#666] text-xs mb-5">
                {tablePrompt.gameType === "blackjack" || tablePrompt.gameType === "roulette" || tablePrompt.gameType === "slots" || tablePrompt.gameType === "poker" || tablePrompt.gameType === "craps"
                  ? `${seatedCount(tablePrompt.gameType)} players seated`
                  : "Coming Soon"}
              </div>
              {tablePrompt.gameType === "blackjack" || tablePrompt.gameType === "roulette" || tablePrompt.gameType === "slots" || tablePrompt.gameType === "poker" || tablePrompt.gameType === "craps" ? (
                <div className="flex gap-2 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSitDown}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold"
                    style={{
                      background: "linear-gradient(135deg, #FFD700, #FFA500)",
                      color: "#000",
                    }}
                  >
                    Sit Down
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTablePrompt(null)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    Cancel
                  </motion.button>
                </div>
              ) : (
                <div
                  className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-[#666]"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  Coming Soon
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Make Money Modal */}
      <AnimatePresence>
        {moneyPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={(e) => { e.stopPropagation(); if (moneyPrompt === "confirm" || moneyPrompt === "done") closeMakeMoney(); }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="rounded-2xl p-6 text-center max-w-xs w-full mx-4"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Confirm */}
              {moneyPrompt === "confirm" && (
                <>
                  <div className="w-20 h-28 mx-auto mb-3 relative">
                    <Image
                      src="/makemoney.png"
                      alt="Make Money"
                      width={80}
                      height={112}
                      className="object-contain"
                    />
                  </div>
                  <div className="text-white text-lg font-bold mb-1">
                    Make some money?
                  </div>
                  {cooldownRemaining > 0 ? (
                    <>
                      <div className="text-[#666] text-xs mb-5">
                        Come back in {Math.floor(cooldownRemaining / 60)}m {cooldownRemaining % 60}s
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={closeMakeMoney}
                        className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/50"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        OK
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <div className="text-[#666] text-xs mb-5">
                        Put in some work and earn $25-$200
                      </div>
                      <div className="flex gap-2 justify-center">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={startMakeMoney}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold"
                          style={{
                            background: "linear-gradient(135deg, #4ADE80, #22C55E)",
                            color: "#000",
                          }}
                        >
                          Yeah!
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={closeMakeMoney}
                          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50"
                          style={{ background: "rgba(255,255,255,0.05)" }}
                        >
                          Nah
                        </motion.button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Loading */}
              {moneyPrompt === "loading" && (
                <>
                  <div className="w-20 h-28 mx-auto mb-4 relative">
                    <motion.div
                      animate={{ rotate: [0, -3, 3, -3, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <Image
                        src="/makemoney.png"
                        alt="Working..."
                        width={80}
                        height={112}
                        className="object-contain"
                      />
                    </motion.div>
                  </div>
                  <div className="text-white text-lg font-bold mb-2">
                    Hustlin&apos;...
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 rounded-full overflow-hidden mb-2"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 30, ease: "linear" }}
                      style={{ background: "linear-gradient(90deg, #FFD700, #4ADE80)" }}
                    />
                  </div>

                  <div className="text-casino-gold font-mono text-2xl font-bold mb-1">
                    {moneyTimer}s
                  </div>
                  <div className="text-[#666] text-[10px]">
                    Getting that bread...
                  </div>
                </>
              )}

              {/* Done */}
              {moneyPrompt === "done" && (
                <>
                  <div className="w-20 h-28 mx-auto mb-3 relative">
                    <Image
                      src="/makemoney.png"
                      alt="Paid"
                      width={80}
                      height={112}
                      className="object-contain"
                    />
                  </div>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <div className="text-white text-lg font-bold mb-2">
                      Money made!
                    </div>
                    <span
                      className="inline-block px-5 py-2 rounded-full text-xl font-bold mb-4"
                      style={{
                        background: "rgba(74,222,128,0.15)",
                        color: "#4ADE80",
                        border: "1px solid #4ADE8033",
                      }}
                    >
                      +${moneyPayout}
                    </span>
                  </motion.div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={closeMakeMoney}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold mt-2"
                    style={{
                      background: "linear-gradient(135deg, #FFD700, #FFA500)",
                      color: "#000",
                    }}
                  >
                    Nice!
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bar Modal */}
      <AnimatePresence>
        {barPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={(e) => { e.stopPropagation(); if (barPrompt === "menu") closeBar(); }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="rounded-2xl p-5 text-center max-w-sm w-full mx-4"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Menu */}
              {barPrompt === "menu" && (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(168,85,247,0.15)" }}
                  >
                    <Wine size={28} className="text-purple-400" />
                  </div>
                  <div className="text-white text-lg font-bold mb-1">The Bar</div>
                  <div className="text-[#666] text-xs mb-4">
                    Grab a drink for $1 and vibe out
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {DRINKS.map((drink) => (
                      <motion.button
                        key={drink.name}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => orderDrink(drink)}
                        className="flex flex-col items-center gap-1 p-3 rounded-xl"
                        style={{
                          background: `${drink.color}15`,
                          border: `1px solid ${drink.color}33`,
                        }}
                      >
                        <span className="text-2xl">{drink.emoji}</span>
                        <span className="text-[9px] text-white/70 font-medium">{drink.name}</span>
                        <span className="text-[8px] font-mono" style={{ color: drink.color }}>$1</span>
                      </motion.button>
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={closeBar}
                    className="px-5 py-2 rounded-xl text-sm font-medium text-white/50"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    Leave Bar
                  </motion.button>
                </>
              )}

              {/* Drinking — Visualizer */}
              {barPrompt === "drinking" && (
                <>
                  <div className="mb-2">
                    <canvas
                      ref={barCanvasRef}
                      width={320}
                      height={200}
                      className="w-full rounded-xl"
                      style={{ imageRendering: "auto" }}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xl">{selectedDrink.emoji}</span>
                    <span className="text-white text-sm font-bold">{selectedDrink.name}</span>
                  </div>

                  <div className="text-white/40 text-[10px] mb-2">
                    Sit back and enjoy the vibes
                  </div>

                  {/* Timer ring */}
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="#1a1a2e" strokeWidth="3" />
                        <circle
                          cx="24" cy="24" r="20" fill="none"
                          stroke={selectedDrink.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - barTimer / 30)}`}
                          style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-white font-mono text-sm font-bold">
                        {barTimer}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={closeBar}
                    className="px-5 py-2 rounded-xl text-sm font-medium text-white/50"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    Leave Bar
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat */}
      <ChatSidebar playerId={playerId} playerName={playerName} chatContext="lobby" anchorLeft={imgSize.x} />

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

      {/* AFK Prompt */}
      <AnimatePresence>
        {showAfkPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl p-6 text-center max-w-xs mx-4"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div className="text-3xl mb-3">💤</div>
              <div className="text-white text-lg font-bold mb-1">Are you still there?</div>
              <div className="text-[#666] text-xs mb-4">
                You&apos;ll be marked away in 30 seconds
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { resetIdleTimer(); }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  color: "#000",
                }}
              >
                I&apos;m here!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AFK Overlay — player went idle */}
      <AnimatePresence>
        {isAfk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl p-6 text-center max-w-xs mx-4"
              style={{
                background: "linear-gradient(135deg, #111118, #0d0d15)",
                border: "1px solid #2a2a3a",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <div className="text-3xl mb-3">😴</div>
              <div className="text-white text-lg font-bold mb-1">You went away</div>
              <div className="text-[#666] text-xs mb-4">
                You&apos;re no longer visible on the casino floor
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAfkReturn}
                className="px-6 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  color: "#000",
                }}
              >
                I&apos;m back!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
