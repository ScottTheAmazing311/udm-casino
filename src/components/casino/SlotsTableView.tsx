"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Users } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { SlotsGameState } from "@/lib/types";
import { CasinoTable } from "@/lib/store/casino-store";
import { useGameSession } from "@/hooks/useGameSession";
import { SLOT_SYMBOLS, REEL_STRIPS, getSymbolIndex, SlotSymbolId } from "@/lib/slots-logic";
import GameButton from "@/components/ui/GameButton";
import MusicButton from "@/components/ui/MusicButton";

interface SlotsTableViewProps {
  table: CasinoTable;
  playerId: number;
  onLeave: () => void;
}

function getPlayerName(id: number): string {
  return PLAYERS.find((p) => p.id === id)?.name || `Player ${id}`;
}

function getPlayerColor(id: number): string {
  return PLAYERS.find((p) => p.id === id)?.color || "#666";
}

const BET_AMOUNTS = [1, 10, 25, 50, 100, 250, 500];
const SYMBOL_COUNT = SLOT_SYMBOLS.length;
const PANEL_ANGLE = 360 / SYMBOL_COUNT;

export default function SlotsTableView({
  table,
  playerId,
  onLeave,
}: SlotsTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [reelAngles, setReelAngles] = useState([0, 0, 0]);
  const spinRef = useRef(false);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as SlotsGameState | undefined;
  const isMyTurn = state ? state.turnOrder[state.currentSpinnerIndex] === playerId : false;

  // Play reel stop sound
  const playStopSound = useCallback(() => {
    const audio = new Audio("/reel-stop.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  // Animate reels when we get a result
  useEffect(() => {
    if (status === "resolving" && state?.reels && !spinRef.current) {
      spinRef.current = true;
      setSpinning(true);
      setShowResult(false);

      // Calculate target angles for each reel to land on the correct symbol
      const targetAngles = state.reels.map((symbolId, reelIdx) => {
        const symbolIndex = getSymbolIndex(reelIdx, symbolId as SlotSymbolId);
        // Spin several full rotations + land on the target
        const fullSpins = (3 + reelIdx) * 360; // More spins for later reels
        return fullSpins + symbolIndex * PANEL_ANGLE;
      });

      // Stagger the reel stops
      const delays = [1500, 2250, 3000];

      delays.forEach((delay, i) => {
        setTimeout(() => {
          setReelAngles((prev) => {
            const next = [...prev];
            next[i] = targetAngles[i];
            return next;
          });
          playStopSound();

          // After last reel stops, show result
          if (i === 2) {
            setTimeout(() => {
              setSpinning(false);
              setShowResult(true);
              spinRef.current = false;
            }, 800);
          }
        }, delay);
      });

      // Start all reels spinning immediately (fast continuous)
      setReelAngles([0, 0, 0]);
      // Tiny delay to trigger transition from 0 -> target
      requestAnimationFrame(() => {
        // Set intermediate fast spin
        setReelAngles([360 * 2, 360 * 2, 360 * 2]);
      });
    }

    if (status === "betting") {
      setShowResult(false);
      setSpinning(false);
      spinRef.current = false;
      setReelAngles([0, 0, 0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, state?.reels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center">
        <div className="text-[#555] text-sm animate-pulse">Loading machine...</div>
      </div>
    );
  }

  // ─── WAITING / LOBBY ────────────────────
  if (!session || status === "waiting") {
    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden">
        <SlotsBg />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={handleLeave}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <ArrowLeft size={16} className="text-white/60" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-display text-white drop-shadow-lg">{table.table_name}</h2>
              <div className="text-white/40 text-[10px] font-mono">${table.min_bet}-${table.max_bet} bets</div>
            </div>
            <MusicButton />
          </div>

          {/* Slot machine preview */}
          <div className="flex justify-center mb-8">
            <SlotMachineFrame>
              <div className="flex gap-2 justify-center py-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{
                      background: "linear-gradient(180deg, #0d0d20, #151530)",
                      border: "1px solid #333",
                      boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
                    }}
                  >
                    <Image
                      src={SLOT_SYMBOLS[i * 3].img}
                      alt={SLOT_SYMBOLS[i * 3].name}
                      width={56}
                      height={56}
                      className="drop-shadow-md"
                    />
                  </div>
                ))}
              </div>
            </SlotMachineFrame>
          </div>

          {/* Seats */}
          <div className="relative mx-auto mb-8" style={{ maxWidth: 600 }}>
            <div className="flex justify-center gap-4">
              {Array.from({ length: Math.min(table.max_seats, 4) }).map((_, i) => {
                const seat = seats.find((s) => s.seat_number === i + 1);
                const isMe = seat?.player_id === playerId;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center gap-1"
                  >
                    {seat ? (
                      <>
                        <div
                          className="w-11 h-11 rounded-full overflow-hidden border-2 shadow-lg"
                          style={{ borderColor: isMe ? "#FFD700" : getPlayerColor(seat.player_id) }}
                        >
                          <Image
                            src={HEADSHOTS[seat.player_id] || ""}
                            alt={getPlayerName(seat.player_id)}
                            width={44} height={44}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <span className="text-[9px] text-white font-medium drop-shadow-md">
                          {isMe ? "You" : getPlayerName(seat.player_id)}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-11 h-11 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <div className="w-2 h-2 rounded-full bg-white/20" />
                        </div>
                        <span className="text-[9px] text-white/30">Empty</span>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-white/40" />
              <span className="text-white/40 text-[10px]">
                {seats.length}/{table.max_seats} seated
              </span>
            </div>
          </div>

          {seats.length >= 1 && seats.some((s) => s.player_id === playerId) && (
            <GameButton onClick={startGame} color="#FFD700" primary>
              Start Spinning
            </GameButton>
          )}

          {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── BETTING / PLAYING ─────────────────
  if ((status === "betting" || (status === "resolving" && !showResult)) && state) {
    const currentSpinner = state.turnOrder[state.currentSpinnerIndex];

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <SlotsBg />
        <SlotsTopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Slot machine with 3D reels */}
          <SlotMachineFrame highlight={false}>
            <div className="flex gap-2 justify-center">
              {[0, 1, 2].map((reelIdx) => (
                <Reel3D
                  key={reelIdx}
                  reelIndex={reelIdx}
                  angle={reelAngles[reelIdx]}
                  spinning={spinning}
                  delay={reelIdx}
                />
              ))}
            </div>
          </SlotMachineFrame>

          {spinning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-white/40 text-sm uppercase tracking-[4px]"
            >
              Spinning...
            </motion.div>
          )}

          {/* Turn indicator */}
          {!isMyTurn && !spinning && (
            <div className="mt-4 text-white/40 text-xs">
              Waiting for {getPlayerName(currentSpinner)} to spin...
            </div>
          )}
        </div>

        {/* Bottom — bet controls */}
        {isMyTurn && !spinning && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative z-20 px-4 pt-3 pb-8"
            style={{ background: "linear-gradient(0deg, rgba(6,6,16,0.95) 50%, transparent)" }}
          >
            <div className="text-center mb-3">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-casino-gold text-[10px] uppercase tracking-[3px] font-bold"
              >
                Your Turn — Place Bet & Spin!
              </motion.div>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              {BET_AMOUNTS
                .filter((amt) => amt >= table.min_bet && amt <= table.max_bet)
                .map((amt) => (
                  <motion.button
                    key={amt}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => sendAction("spin", { amount: amt })}
                    className="w-14 h-14 rounded-full font-mono text-sm font-bold flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #FFD700, #B8860B)",
                      color: "#000",
                      boxShadow: "0 4px 20px rgba(255,215,0,0.25)",
                    }}
                  >
                    ${amt}
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center relative z-20">{error}</div>}
      </div>
    );
  }

  // ─── RESOLVING (show result) ───────────
  if (status === "resolving" && state && showResult) {
    const winAmount = state.netAmount ?? 0;
    const isWin = winAmount > 0;
    const isJackpot = state.winType === "jackpot";

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <SlotsBg />
        <SlotsTopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Slot machine showing final result */}
          <SlotMachineFrame highlight={isWin}>
            <div className="flex gap-2 justify-center py-2">
              {state.reels?.map((symbolId, i) => {
                const sym = SLOT_SYMBOLS.find((s) => s.id === symbolId);
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
                    className="w-20 h-20 rounded-lg flex items-center justify-center"
                    style={{
                      background: "linear-gradient(180deg, #0d0d20, #151530)",
                      border: isWin ? "1px solid #FFD70066" : "1px solid #333",
                      boxShadow: isWin
                        ? "inset 0 0 15px rgba(255,215,0,0.15), 0 0 10px rgba(255,215,0,0.1)"
                        : "inset 0 2px 8px rgba(0,0,0,0.6)",
                    }}
                  >
                    {sym && (
                      <Image
                        src={sym.img}
                        alt={sym.name}
                        width={56}
                        height={56}
                        className="drop-shadow-md"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </SlotMachineFrame>

          {/* Result */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="mt-6 text-center"
          >
            {isJackpot && (
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="flex items-center justify-center gap-2 mb-2"
              >
                <Image src="/slots/diamond.png" alt="" width={32} height={32} />
                <span className="text-2xl font-bold text-casino-gold">JACKPOT!</span>
                <Image src="/slots/diamond.png" alt="" width={32} height={32} />
              </motion.div>
            )}

            <div className="text-white/60 text-sm mb-2">{state.winDescription}</div>

            <span
              className="inline-block px-5 py-2 rounded-full text-lg font-bold"
              style={{
                background: winAmount > 0 ? "rgba(74,222,128,0.15)" : "rgba(255,107,107,0.15)",
                color: winAmount > 0 ? "#4ADE80" : "#FF6B6B",
                border: `1px solid ${winAmount > 0 ? "#4ADE8033" : "#FF6B6B33"}`,
              }}
            >
              {winAmount > 0 ? `+$${winAmount}` : `-$${Math.abs(winAmount)}`}
            </span>

            {state.bet && (
              <div className="mt-2 text-white/30 text-xs font-mono">
                Bet: ${state.bet}
                {state.multiplier > 0 && ` \u00d7 ${state.multiplier} = $${state.bet * state.multiplier}`}
              </div>
            )}

            <div className="flex gap-2 justify-center mt-6">
              <GameButton onClick={() => sendAction("new-round")} color="#FFD700" primary>
                Spin Again
              </GameButton>
              <GameButton onClick={handleLeave} color="#333">
                Leave
              </GameButton>
            </div>
          </motion.div>
        </div>

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center relative z-20">{error}</div>}
      </div>
    );
  }

  return null;
}

// ─── SUB-COMPONENTS ────────────────────────

function SlotsBg() {
  return (
    <div className="absolute inset-0 z-0">
      <Image
        src="/SlotsV2.png"
        alt=""
        fill
        unoptimized
        className="object-cover object-center"
        style={{ imageRendering: "pixelated" }}
        priority
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 20%, rgba(6,6,16,0.7) 50%, rgba(6,6,16,0.95) 100%)",
        }}
      />
    </div>
  );
}

function SlotsTopBar({ table, onLeave }: { table: CasinoTable; onLeave: () => void }) {
  return (
    <div
      className="relative z-30 flex items-center gap-3 px-4 py-3"
      style={{ background: "linear-gradient(180deg, rgba(6,6,16,0.8), transparent)" }}
    >
      <button
        onClick={onLeave}
        className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 border border-white/10 backdrop-blur-sm"
      >
        <ArrowLeft size={14} className="text-white/60" />
      </button>
      <div className="flex-1">
        <div className="text-white text-sm font-semibold drop-shadow-lg">{table.table_name}</div>
        <div className="text-white/40 text-[9px] font-mono">${table.min_bet}-${table.max_bet}</div>
      </div>
      <MusicButton />
    </div>
  );
}

function SlotMachineFrame({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      className="rounded-2xl p-1"
      style={{
        background: highlight
          ? "linear-gradient(135deg, #FFD700, #FFA500, #FFD700)"
          : "linear-gradient(135deg, #3a2a1a, #2a1a0a, #3a2a1a)",
        boxShadow: highlight
          ? "0 0 60px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
      animate={highlight ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5, repeat: highlight ? Infinity : 0 }}
    >
      <div
        className="rounded-xl px-4 py-3 w-[280px] sm:w-[340px] md:w-[400px]"
        style={{
          background: "linear-gradient(180deg, #1a1028, #120a1e)",
          border: "2px solid #2a2040",
        }}
      >
        {/* Machine header with lights */}
        <div className="text-center mb-2">
          <div className="flex justify-center gap-1 mb-1.5">
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                animate={{
                  background: ["#FFD700", "#FF6B6B", "#4ADE80", "#FFD700"],
                  boxShadow: [
                    "0 0 4px #FFD700",
                    "0 0 4px #FF6B6B",
                    "0 0 4px #4ADE80",
                    "0 0 4px #FFD700",
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
          <div
            className="text-casino-gold font-bold text-sm uppercase tracking-[6px]"
            style={{ textShadow: "0 0 15px rgba(255,215,0,0.6)" }}
          >
            LUCKY SLOTS
          </div>
        </div>

        {/* Reel viewport */}
        <div
          className="rounded-lg overflow-hidden relative"
          style={{
            background: "linear-gradient(180deg, #080810, #0d0d1a, #080810)",
            border: "2px solid #222",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
          }}
        >
          {/* Payline markers */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-6 rounded-r-sm z-10"
            style={{ background: "#FF6B6B", boxShadow: "0 0 6px #FF6B6B" }}
          />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-6 rounded-l-sm z-10"
            style={{ background: "#FF6B6B", boxShadow: "0 0 6px #FF6B6B" }}
          />

          {/* Vignette overlay */}
          <div
            className="absolute inset-0 z-[5] pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.6) 100%)",
            }}
          />

          {children}
        </div>

        {/* Bottom chrome */}
        <div className="flex items-center justify-center mt-2">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #FFD70033, transparent)" }} />
          <div className="px-3 text-[8px] text-casino-gold/40 uppercase tracking-[3px] font-bold">
            payline
          </div>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #FFD70033, transparent)" }} />
        </div>
      </div>
    </motion.div>
  );
}

// 3D Cylinder Reel
function Reel3D({
  reelIndex,
  angle,
  spinning,
  delay,
}: {
  reelIndex: number;
  angle: number;
  spinning: boolean;
  delay: number;
}) {
  const strip = REEL_STRIPS[reelIndex];
  const panelSize = 80; // height of each symbol panel
  const radius = (panelSize / 2) / Math.tan(Math.PI / SYMBOL_COUNT);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 80,
        height: 80,
        perspective: 400,
      }}
    >
      <div
        className="absolute w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateZ(${-radius}px) rotateX(${-angle}deg)`,
          transition: spinning
            ? `transform ${1.5 + delay * 0.5}s cubic-bezier(0.2, 0.8, 0.3, 1)`
            : "transform 0.3s ease-out",
        }}
      >
        {strip.map((symbolId, idx) => {
          const sym = SLOT_SYMBOLS.find((s) => s.id === symbolId);
          if (!sym) return null;
          const rot = idx * PANEL_ANGLE;
          return (
            <div
              key={`${reelIndex}-${idx}`}
              className="absolute w-full flex items-center justify-center"
              style={{
                height: panelSize,
                backfaceVisibility: "hidden",
                transform: `rotateX(${rot}deg) translateZ(${radius}px)`,
              }}
            >
              <Image
                src={sym.img}
                alt={sym.name}
                width={56}
                height={56}
                className="drop-shadow-md"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
