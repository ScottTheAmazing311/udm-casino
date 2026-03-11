"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Dice5 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { CrapsGameState, CrapsBetType } from "@/lib/types";
import { CasinoTable } from "@/lib/store/casino-store";
import { useGameSession } from "@/hooks/useGameSession";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import GameButton from "@/components/ui/GameButton";
import MusicButton from "@/components/ui/MusicButton";

interface CrapsTableViewProps {
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

const BET_CHIPS = [1, 5, 10, 25, 50, 100];

// ─── DICE DOT COMPONENT ──────────────────
function DiceFace({ value, size = 64 }: { value: number; size?: number }) {
  const dotSize = size * 0.16;
  const pad = size * 0.22;
  const mid = size / 2;

  const dotPositions: Record<number, [number, number][]> = {
    1: [[mid, mid]],
    2: [[pad, size - pad], [size - pad, pad]],
    3: [[pad, size - pad], [mid, mid], [size - pad, pad]],
    4: [[pad, pad], [pad, size - pad], [size - pad, pad], [size - pad, size - pad]],
    5: [[pad, pad], [pad, size - pad], [mid, mid], [size - pad, pad], [size - pad, size - pad]],
    6: [[pad, pad], [pad, mid], [pad, size - pad], [size - pad, pad], [size - pad, mid], [size - pad, size - pad]],
  };

  return (
    <div
      className="relative rounded-xl"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(145deg, #f5f5f5, #d4d4d4)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.1)",
        border: "1px solid rgba(0,0,0,0.15)",
      }}
    >
      {dotPositions[value]?.map(([x, y], i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            left: x - dotSize / 2,
            top: y - dotSize / 2,
            background: "radial-gradient(circle at 35% 35%, #444, #111)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      ))}
    </div>
  );
}

// ─── ROLLING DICE ANIMATION ───────────────
function RollingDice({ dice, onComplete }: { dice: [number, number]; onComplete: () => void }) {
  const [rolling, setRolling] = useState(true);
  const [displayValues, setDisplayValues] = useState<[number, number]>([1, 1]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let count = 0;
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplayValues([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      count++;
      if (count >= 12) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayValues(dice);
        setRolling(false);
        setTimeout(onComplete, 600);
      }
    }, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dice[0], dice[1]]);

  return (
    <div className="flex gap-5 justify-center">
      {displayValues.map((d, i) => (
        <motion.div
          key={i}
          animate={rolling ? {
            rotate: [0, 15, -15, 10, -10, 5, 0],
            y: [0, -20, 0, -10, 0, -5, 0],
          } : { rotate: 0, y: 0 }}
          transition={rolling ? {
            duration: 0.4,
            repeat: Infinity,
            delay: i * 0.1,
          } : { type: "spring", stiffness: 300 }}
        >
          <DiceFace value={d} size={64} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── ON/OFF PUCK ──────────────────────────
function PointPuck({ point }: { point: number | null }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex items-center justify-center"
    >
      <div
        className="w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold border-2"
        style={{
          background: point
            ? "linear-gradient(135deg, #fff, #e8e8e8)"
            : "linear-gradient(135deg, #222, #111)",
          borderColor: point ? "#333" : "#555",
          boxShadow: point
            ? "0 4px 16px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.1)"
            : "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <span
          className="text-[8px] uppercase tracking-wider"
          style={{ color: point ? "#000" : "#666" }}
        >
          {point ? "ON" : "OFF"}
        </span>
        {point && (
          <span className="text-base font-mono font-black text-black leading-none">{point}</span>
        )}
      </div>
    </motion.div>
  );
}

export default function CrapsTableView({
  table,
  playerId,
  onLeave,
}: CrapsTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [selectedChip, setSelectedChip] = useState(25);
  const [rollComplete, setRollComplete] = useState(false);
  const [rollKey, setRollKey] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as CrapsGameState | undefined;
  const isShooter = state ? state.turnOrder[state.shooterIndex] === playerId : false;
  const myBets = state?.bets?.[playerId] || [];
  const myTotalBet = myBets.reduce((s, b) => s + b.amount, 0);
  const diceRolling = state?.dice !== null && state?.dice !== undefined;

  // Reset roll animation state when dice change
  useEffect(() => {
    if (state?.dice) {
      setRollComplete(false);
      setShowResults(false);
      setRollKey((k) => k + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.dice?.[0], state?.dice?.[1]]);

  // Auto-acknowledge after showing results (non-round-over rolls)
  useEffect(() => {
    if (rollComplete && state?.dice && !state?.roundOver) {
      const timer = setTimeout(() => {
        sendAction("acknowledge");
      }, 2500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollComplete, state?.roundOver]);

  // Auto-acknowledge round-over results after a longer delay
  useEffect(() => {
    if (rollComplete && state?.dice && state?.roundOver) {
      setShowResults(true);
      const timer = setTimeout(() => {
        sendAction("acknowledge");
        setShowResults(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollComplete, state?.roundOver]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center">
        <div className="text-[#555] text-sm animate-pulse">Loading table...</div>
      </div>
    );
  }

  // ─── WAITING / LOBBY ────────────────────
  if (!session || status === "waiting") {
    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden">
        <TableBg />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={handleLeave}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <ArrowLeft size={16} className="text-white/60" />
            </button>
            <div>
              <h2 className="text-xl font-display text-white drop-shadow-lg">{table.table_name}</h2>
              <div className="text-white/40 text-[10px] font-mono">${table.min_bet}-${table.max_bet} bets</div>
            </div>
          </div>

          <div className="relative mx-auto mb-8" style={{ maxWidth: 380 }}>
            <div className="pt-32 pb-6">
              <div className="flex justify-center gap-4 flex-wrap">
                {Array.from({ length: Math.min(table.max_seats, 8) }).map((_, i) => {
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
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-white/40" />
              <span className="text-white/40 text-[10px]">{seats.length}/{table.max_seats} seated</span>
            </div>
          </div>

          {seats.length >= 1 && seats.some((s) => s.player_id === playerId) && (
            <GameButton onClick={startGame} color="#FFD700" primary>
              Start Craps
            </GameButton>
          )}

          {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── MAIN GAME VIEW (betting + rolling combined) ──────
  if (state) {
    const shooterName = getPlayerName(state.turnOrder[state.shooterIndex]);
    const diceSum = state.dice ? state.dice[0] + state.dice[1] : null;

    // Aggregate bets by type for chip display on board
    const cellBets: Record<string, { playerId: number; amount: number }[]> = {};
    if (state.bets) {
      for (const [pid, bets] of Object.entries(state.bets)) {
        for (const bet of bets) {
          const key = bet.type;
          if (!cellBets[key]) cellBets[key] = [];
          const existing = cellBets[key].find((b) => b.playerId === Number(pid));
          if (existing) existing.amount += bet.amount;
          else cellBets[key].push({ playerId: Number(pid), amount: bet.amount });
        }
      }
    }

    const handlePlaceBet = (betType: CrapsBetType) => {
      if (diceRolling && !rollComplete) return;
      sendAction("place-bet", { betType, amount: selectedChip });
    };

    const renderChipsOnCell = (betType: string) => {
      const bets = cellBets[betType];
      if (!bets || bets.length === 0) return null;
      return (
        <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
          {bets.map((b) => (
            <div
              key={b.playerId}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border border-black/30"
              style={{
                background: b.playerId === playerId
                  ? "linear-gradient(135deg, #FFD700, #B8860B)"
                  : `linear-gradient(135deg, ${getPlayerColor(b.playerId)}, ${getPlayerColor(b.playerId)}88)`,
                color: b.playerId === playerId ? "#000" : "#fff",
              }}
            >
              {b.amount}
            </div>
          ))}
        </div>
      );
    };

    // Place bet numbers available during point phase
    const placeNumbers: { num: number; type: CrapsBetType; color: string }[] = [
      { num: 4, type: "place4", color: "#F472B6" },
      { num: 5, type: "place5", color: "#FB923C" },
      { num: 6, type: "place6", color: "#60A5FA" },
      { num: 8, type: "place8", color: "#A78BFA" },
      { num: 9, type: "place9", color: "#34D399" },
      { num: 10, type: "place10", color: "#FBBF24" },
    ];

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 overflow-auto px-2 py-1">
          <div className="max-w-3xl mx-auto">

            {/* ─── STATUS BAR: Shooter + Phase + Puck ─── */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <Dice5 size={12} className="text-casino-gold" />
                <span className="text-white/60 text-[10px]">
                  Shooter: <span className="text-casino-gold font-bold">{isShooter ? "You" : shooterName}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-full bg-white/10">
                  <span className="text-white/50 text-[9px] uppercase tracking-wider font-bold">
                    {state.phase === "come-out" ? "Come-Out" : "Point"}
                  </span>
                </div>
                <PointPuck point={state.point} />
              </div>
            </div>

            {/* ─── OTHER PLAYERS ─── */}
            {state.turnOrder.length > 1 && (
              <div className="flex justify-center gap-3 mb-2">
                {state.turnOrder.filter((pid) => pid !== playerId).map((pid) => {
                  const hasBets = (state.bets[pid] || []).length > 0;
                  const isShtr = state.turnOrder[state.shooterIndex] === pid;
                  return (
                    <div key={pid} className="flex flex-col items-center gap-0.5">
                      <PlayerAvatar playerId={pid} size={22} color={getPlayerColor(pid)} />
                      <span className={`text-[7px] font-bold ${isShtr ? "text-casino-gold" : hasBets ? "text-white/50" : "text-white/20"}`}>
                        {isShtr ? "Shooter" : hasBets ? `$${(state.bets[pid] || []).reduce((s, b) => s + b.amount, 0)}` : getPlayerName(pid).split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── TWO-COLUMN LAYOUT ─── */}
            <div className="flex flex-col lg:flex-row gap-4">

              {/* ─── LEFT COLUMN: Dice + Roll + Shooter + History ─── */}
              <div className="flex-1 min-w-0">
                {/* ─── DICE AREA ─── */}
                <div className="relative mb-2">
                  <AnimatePresence mode="wait">
                    {state.dice && (
                      <motion.div
                        key={rollKey}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center py-3"
                      >
                        <RollingDice
                          dice={state.dice}
                          onComplete={() => setRollComplete(true)}
                        />

                        {/* Sum + Description */}
                        {rollComplete && diceSum !== null && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center mt-2"
                          >
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center font-mono text-xl font-black mb-1"
                              style={{
                                background: state.sevenOut
                                  ? "linear-gradient(135deg, #EF4444, #DC2626)"
                                  : (diceSum === 7 || diceSum === 11) && state.phase === "come-out"
                                  ? "linear-gradient(135deg, #4ADE80, #22C55E)"
                                  : diceSum === state.point
                                  ? "linear-gradient(135deg, #FFD700, #FFA500)"
                                  : "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
                                color: state.sevenOut ? "#fff"
                                  : (diceSum === 7 || diceSum === 11) ? "#fff"
                                  : diceSum === state.point ? "#000"
                                  : "#fff",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                              }}
                            >
                              {diceSum}
                            </div>
                            {state.lastDescription && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="px-4 py-1 rounded-full text-xs font-bold"
                                style={{
                                  background: state.sevenOut
                                    ? "rgba(239,68,68,0.2)"
                                    : state.roundOver
                                    ? "rgba(74,222,128,0.2)"
                                    : "rgba(255,255,255,0.1)",
                                  color: state.sevenOut
                                    ? "#FF6B6B"
                                    : state.roundOver
                                    ? "#4ADE80"
                                    : "#fff",
                                }}
                              >
                                {state.lastDescription}
                              </motion.div>
                            )}
                          </motion.div>
                        )}

                        {/* Per-player results */}
                        {rollComplete && state.results && showResults && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 w-full max-w-xs"
                          >
                            {state.turnOrder.map((pid) => {
                              const r = state.results?.[pid];
                              if (!r || (!r.result && r.amount === 0)) return null;
                              return (
                                <div key={pid} className="text-center text-[11px] mb-0.5">
                                  <span className="text-white/50">{pid === playerId ? "You" : getPlayerName(pid)}: </span>
                                  <span style={{ color: r.amount > 0 ? "#4ADE80" : r.amount < 0 ? "#FF6B6B" : "#888" }}>
                                    {r.result} {r.amount > 0 ? `+$${r.amount}` : r.amount < 0 ? `-$${Math.abs(r.amount)}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}

                        {/* Inline results for non-round-over */}
                        {rollComplete && state.results && !state.roundOver && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1 w-full max-w-xs"
                          >
                            {state.turnOrder.map((pid) => {
                              const r = state.results?.[pid];
                              if (!r || (!r.result && r.amount === 0)) return null;
                              return (
                                <div key={pid} className="text-center text-[10px]">
                                  <span className="text-white/40">{pid === playerId ? "You" : getPlayerName(pid)}: </span>
                                  <span style={{ color: r.amount > 0 ? "#4ADE80" : r.amount < 0 ? "#FF6B6B" : "#888" }}>
                                    {r.amount > 0 ? `+$${r.amount}` : r.amount < 0 ? `-$${Math.abs(r.amount)}` : "$0"}
                                  </span>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Roll button — shown when no dice are displayed and shooter */}
                  {!state.dice && isShooter && (
                    <div className="flex justify-center py-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => sendAction("roll")}
                        className="px-8 py-3.5 rounded-2xl text-base font-bold uppercase tracking-wider"
                        style={{
                          background: "linear-gradient(135deg, #EF4444, #DC2626)",
                          color: "#fff",
                          boxShadow: "0 8px 30px rgba(239,68,68,0.4)",
                        }}
                      >
                        🎲 Roll the Dice
                      </motion.button>
                    </div>
                  )}

                  {!state.dice && !isShooter && (
                    <div className="text-center py-3">
                      <div className="text-white/30 text-sm">Waiting for {shooterName} to roll...</div>
                    </div>
                  )}
                </div>

                {/* ─── ROLL HISTORY ─── */}
                {state.rollHistory.length > 0 && (
                  <div className="mb-3">
                    <div className="text-white/20 text-[7px] uppercase tracking-wider mb-1 text-center">History</div>
                    <div className="flex gap-1 justify-center flex-wrap">
                      {state.rollHistory.slice(-16).map((roll, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-mono font-bold"
                          style={{
                            background: roll.sum === 7
                              ? "rgba(239,68,68,0.2)"
                              : roll.sum === state.point
                              ? "rgba(255,215,0,0.2)"
                              : "rgba(255,255,255,0.06)",
                            color: roll.sum === 7
                              ? "#FF6B6B"
                              : roll.sum === state.point
                              ? "#FFD700"
                              : "#555",
                          }}
                        >
                          {roll.sum}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── RIGHT COLUMN: Betting Board + Chips + Bets ─── */}
              <div className="flex-1 min-w-0">
                {/* ─── CRAPS BETTING BOARD ─── */}
                <div className="rounded-2xl overflow-hidden border border-white/10 mb-2"
                  style={{ background: "rgba(0,80,0,0.6)", backdropFilter: "blur(8px)" }}
                >
                  {/* Place numbers row (only during point phase) */}
                  {state.phase === "point" && (
                    <div className="grid grid-cols-6 gap-px bg-white/10">
                      {placeNumbers.map(({ num, type, color }) => (
                        <motion.button
                          key={type}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePlaceBet(type)}
                          className="relative p-2 text-center"
                          style={{
                            background: num === state.point
                              ? `${color}30`
                              : `${color}10`,
                            borderBottom: num === state.point ? `2px solid ${color}` : "none",
                          }}
                        >
                          <div className="text-lg font-mono font-bold" style={{ color }}>{num}</div>
                          <div className="text-[7px] font-bold uppercase" style={{ color: `${color}88` }}>Place</div>
                          {renderChipsOnCell(type)}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Don't Pass / Pass Line */}
                  <div className="grid grid-cols-2 gap-px bg-white/10">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePlaceBet("dontpass")}
                      className="relative p-2.5 text-center"
                      style={{ background: "rgba(239,68,68,0.1)" }}
                    >
                      <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Don&apos;t Pass</div>
                      <div className="text-[7px] text-red-300/50 mt-0.5">Bar 12</div>
                      {renderChipsOnCell("dontpass")}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePlaceBet("pass")}
                      className="relative p-2.5 text-center"
                      style={{ background: "rgba(74,222,128,0.1)" }}
                    >
                      <div className="text-[11px] font-bold text-green-400 uppercase tracking-wide">Pass Line</div>
                      <div className="text-[7px] text-green-300/50 mt-0.5">Win 7/11</div>
                      {renderChipsOnCell("pass")}
                    </motion.button>
                  </div>

                  {/* Field bet */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePlaceBet("field")}
                    className="relative w-full p-2.5 text-center border-t border-white/10"
                    style={{ background: "rgba(245,158,11,0.08)" }}
                  >
                    <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Field</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      {[2, 3, 4, 9, 10, 11, 12].map((n) => (
                        <span
                          key={n}
                          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold"
                          style={{
                            background: n === 2 || n === 12 ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)",
                            color: n === 2 || n === 12 ? "#FFD700" : "#F59E0B",
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <div className="text-[7px] text-amber-300/50 mt-0.5">2 &amp; 12 pay 2x</div>
                    {renderChipsOnCell("field")}
                  </motion.button>
                </div>

                {/* ─── CHIP SELECTOR ─── */}
                <div
                  className="mb-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex gap-1.5 justify-center">
                    {BET_CHIPS
                      .filter((amt) => amt >= table.min_bet && amt <= table.max_bet)
                      .map((amt) => (
                        <motion.button
                          key={amt}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setSelectedChip(amt)}
                          className="w-11 h-11 rounded-full font-mono text-[10px] font-bold flex items-center justify-center transition-all"
                          style={{
                            background: selectedChip === amt
                              ? "linear-gradient(135deg, #FFD700, #B8860B)"
                              : "rgba(255,255,255,0.08)",
                            color: selectedChip === amt ? "#000" : "#777",
                            boxShadow: selectedChip === amt ? "0 4px 16px rgba(255,215,0,0.3)" : "none",
                            border: selectedChip === amt ? "2px solid #FFD700" : "2px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          ${amt}
                        </motion.button>
                      ))}
                  </div>
                </div>

                {/* ─── MY BETS SUMMARY ─── */}
                {myBets.length > 0 && (
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {myBets.map((bet, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-2 py-0.5 rounded-lg text-[8px] font-bold"
                          style={{
                            background: "rgba(255,215,0,0.1)",
                            color: "#FFD700",
                            border: "1px solid rgba(255,215,0,0.2)",
                          }}
                        >
                          {bet.type.startsWith("place") ? `Place ${bet.type.replace("place", "")}` : bet.type === "dontpass" ? "Don't Pass" : bet.type.charAt(0).toUpperCase() + bet.type.slice(1)} ${bet.amount}
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-casino-gold text-[10px] font-mono">Total: ${myTotalBet}</span>
                      {!diceRolling && (
                        <button
                          onClick={() => sendAction("clear-bets")}
                          className="text-[9px] text-white/30 hover:text-white/60 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {error && <div className="px-4 pb-2 text-casino-red text-xs text-center relative z-20">{error}</div>}
      </div>
    );
  }

  return null;
}

// ─── SUB-COMPONENTS ──────────────────────

function TableBg() {
  return (
    <div className="absolute inset-0 z-0">
      <Image
        src="/CrapsV2.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 40%, rgba(6,6,16,0.7) 75%, rgba(6,6,16,0.95) 100%)",
        }}
      />
    </div>
  );
}

function TopBar({ table, onLeave }: { table: CasinoTable; onLeave: () => void }) {
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
