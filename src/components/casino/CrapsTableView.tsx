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

const BET_OPTIONS: { type: CrapsBetType; label: string; desc: string; color: string }[] = [
  { type: "pass", label: "Pass Line", desc: "Win on 7/11, lose on 2/3/12", color: "#4ADE80" },
  { type: "dontpass", label: "Don't Pass", desc: "Opposite of Pass", color: "#EF4444" },
  { type: "field", label: "Field", desc: "Win on 2,3,4,9,10,11,12", color: "#F59E0B" },
  { type: "place6", label: "Place 6", desc: "Win when 6 rolls, pays 7:6", color: "#60A5FA" },
  { type: "place8", label: "Place 8", desc: "Win when 8 rolls, pays 7:6", color: "#A78BFA" },
];

const BET_AMOUNTS = [5, 10, 25, 50, 100];

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
          <DiceFace value={d} size={72} />
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
        className="w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold border-2"
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
          className="text-[9px] uppercase tracking-wider"
          style={{ color: point ? "#000" : "#666" }}
        >
          {point ? "ON" : "OFF"}
        </span>
        {point && (
          <span className="text-lg font-mono font-black text-black leading-none">{point}</span>
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
  const [selectedBetType, setSelectedBetType] = useState<CrapsBetType>("pass");
  const [selectedChip, setSelectedChip] = useState(25);
  const [rollComplete, setRollComplete] = useState(false);
  const [rollKey, setRollKey] = useState(0);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as CrapsGameState | undefined;
  const isShooter = state ? state.turnOrder[state.shooterIndex] === playerId : false;
  const myBets = state?.bets?.[playerId] || [];
  const myTotalBet = myBets.reduce((s, b) => s + b.amount, 0);
  const isReady = state?.readyPlayers?.includes(playerId) || false;

  // Reset roll animation state when dice change
  useEffect(() => {
    if (state?.dice) {
      setRollComplete(false);
      setRollKey((k) => k + 1);
    }
  }, [state?.dice?.[0], state?.dice?.[1]]);

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

  // ─── BETTING PHASE ──────────────────────
  if (status === "betting" && state) {
    const otherPlayers = state.turnOrder.filter((pid) => pid !== playerId);
    const shooterName = getPlayerName(state.turnOrder[state.shooterIndex]);

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

    const placeBet = (betType: CrapsBetType) => {
      if (isReady) return;
      setSelectedBetType(betType);
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

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 overflow-auto px-2 py-2">
          <div className="max-w-[380px] mx-auto">
            {/* Shooter & ON/OFF puck */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <Dice5 size={12} className="text-casino-gold" />
                <span className="text-white/60 text-[10px]">
                  Shooter: <span className="text-casino-gold font-bold">{isShooter ? "You" : shooterName}</span>
                </span>
              </div>
              <PointPuck point={state.point} />
            </div>

            {/* Other players status */}
            {otherPlayers.length > 0 && (
              <div className="flex justify-center gap-3 mb-3">
                {otherPlayers.map((pid) => {
                  const hasBets = (state.bets[pid] || []).length > 0;
                  const ready = state.readyPlayers.includes(pid);
                  return (
                    <div key={pid} className="flex flex-col items-center gap-0.5">
                      <PlayerAvatar playerId={pid} size={24} color={getPlayerColor(pid)} />
                      <span className={`text-[7px] font-bold ${ready ? "text-casino-green" : hasBets ? "text-casino-gold" : "text-white/30"}`}>
                        {ready ? "Ready" : hasBets ? "Betting" : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── CRAPS BOARD ─────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-white/10 mb-3"
              style={{ background: "rgba(0,80,0,0.6)", backdropFilter: "blur(8px)" }}
            >
              {/* Top row: Don't Pass / Don't Come */}
              <div className="grid grid-cols-2 gap-px bg-white/10">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => placeBet("dontpass")}
                  className="relative p-3 text-center"
                  style={{
                    background: selectedBetType === "dontpass" ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.1)",
                    border: selectedBetType === "dontpass" ? "2px solid #EF4444" : "2px solid transparent",
                  }}
                >
                  <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Don&apos;t Pass</div>
                  <div className="text-[8px] text-red-300/60 mt-0.5">Bar 12 · Opposite of Pass</div>
                  {renderChipsOnCell("dontpass")}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => placeBet("dontcome")}
                  className="relative p-3 text-center"
                  style={{
                    background: selectedBetType === "dontcome" ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.1)",
                    border: selectedBetType === "dontcome" ? "2px solid #EF4444" : "2px solid transparent",
                  }}
                >
                  <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Don&apos;t Come</div>
                  <div className="text-[8px] text-red-300/60 mt-0.5">Opposite of Come</div>
                  {renderChipsOnCell("dontcome")}
                </motion.button>
              </div>

              {/* Main row: Pass Line */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => placeBet("pass")}
                className="relative w-full p-4 text-center border-t border-b border-white/10"
                style={{
                  background: selectedBetType === "pass" ? "rgba(74,222,128,0.25)" : "rgba(74,222,128,0.08)",
                  border: selectedBetType === "pass" ? "2px solid #4ADE80" : "2px solid transparent",
                }}
              >
                <div className="text-lg font-bold text-green-400 uppercase tracking-widest">Pass Line</div>
                <div className="text-[9px] text-green-300/60 mt-0.5">Win on 7 or 11 · Lose on 2, 3, or 12</div>
                {renderChipsOnCell("pass")}
              </motion.button>

              {/* Come bet */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => placeBet("come")}
                className="relative w-full p-3 text-center border-b border-white/10"
                style={{
                  background: selectedBetType === "come" ? "rgba(74,222,128,0.25)" : "rgba(74,222,128,0.08)",
                  border: selectedBetType === "come" ? "2px solid #4ADE80" : "2px solid transparent",
                }}
              >
                <div className="text-sm font-bold text-green-400 uppercase tracking-wider">Come</div>
                <div className="text-[8px] text-green-300/60 mt-0.5">Like Pass but mid-round</div>
                {renderChipsOnCell("come")}
              </motion.button>

              {/* Field bet */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => placeBet("field")}
                className="relative w-full p-3 text-center border-b border-white/10"
                style={{
                  background: selectedBetType === "field" ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.08)",
                  border: selectedBetType === "field" ? "2px solid #F59E0B" : "2px solid transparent",
                }}
              >
                <div className="text-sm font-bold text-amber-400 uppercase tracking-wider">Field</div>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  {[2, 3, 4, 9, 10, 11, 12].map((n) => (
                    <span
                      key={n}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold"
                      style={{
                        background: n === 2 || n === 12 ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.1)",
                        color: n === 2 || n === 12 ? "#FFD700" : "#F59E0B",
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <div className="text-[8px] text-amber-300/60 mt-1">2 &amp; 12 pay 2x · Others pay 1x</div>
                {renderChipsOnCell("field")}
              </motion.button>

              {/* Place bets row */}
              <div className="grid grid-cols-2 gap-px bg-white/10">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => placeBet("place6")}
                  className="relative p-3 text-center"
                  style={{
                    background: selectedBetType === "place6" ? "rgba(96,165,250,0.3)" : "rgba(96,165,250,0.08)",
                    border: selectedBetType === "place6" ? "2px solid #60A5FA" : "2px solid transparent",
                  }}
                >
                  <div className="text-2xl font-mono font-bold text-blue-400">6</div>
                  <div className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Place 6</div>
                  <div className="text-[7px] text-blue-300/60">Pays 7:6</div>
                  {renderChipsOnCell("place6")}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => placeBet("place8")}
                  className="relative p-3 text-center"
                  style={{
                    background: selectedBetType === "place8" ? "rgba(167,139,250,0.3)" : "rgba(167,139,250,0.08)",
                    border: selectedBetType === "place8" ? "2px solid #A78BFA" : "2px solid transparent",
                  }}
                >
                  <div className="text-2xl font-mono font-bold text-purple-400">8</div>
                  <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wide">Place 8</div>
                  <div className="text-[7px] text-purple-300/60">Pays 7:6</div>
                  {renderChipsOnCell("place8")}
                </motion.button>
              </div>
            </div>

            {/* Chip selector */}
            {!isReady && (
              <div
                className="mb-3 rounded-2xl px-4 py-3"
                style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="text-white/50 text-[9px] uppercase tracking-wider text-center mb-2 font-bold">Select Chip Amount</div>
                <div className="flex gap-2 justify-center">
                  {BET_AMOUNTS
                    .filter((amt) => amt >= table.min_bet && amt <= table.max_bet)
                    .map((amt) => (
                      <motion.button
                        key={amt}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setSelectedChip(amt)}
                        className="w-12 h-12 rounded-full font-mono text-xs font-bold flex items-center justify-center transition-all"
                        style={{
                          background: selectedChip === amt
                            ? "linear-gradient(135deg, #FFD700, #B8860B)"
                            : "rgba(255,255,255,0.1)",
                          color: selectedChip === amt ? "#000" : "#aaa",
                          boxShadow: selectedChip === amt ? "0 4px 20px rgba(255,215,0,0.3)" : "none",
                          border: selectedChip === amt ? "2px solid #FFD700" : "2px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        ${amt}
                      </motion.button>
                    ))}
                </div>
              </div>
            )}

            {/* My bets summary */}
            {myBets.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {myBets.map((bet, i) => {
                    const opt = BET_OPTIONS.find((o) => o.type === bet.type);
                    return (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold"
                        style={{
                          background: `${opt?.color || "#666"}20`,
                          color: opt?.color || "#666",
                          border: `1px solid ${opt?.color || "#666"}40`,
                        }}
                      >
                        {opt?.label} ${bet.amount}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="text-casino-gold text-xs font-mono text-center mt-1.5">
                  Total: ${myTotalBet}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-center pb-6">
              {myBets.length > 0 && !isReady && (
                <>
                  <GameButton onClick={() => sendAction("ready")} color="#4ADE80" primary>
                    Ready to Roll
                  </GameButton>
                  <GameButton onClick={() => sendAction("clear-bets")} color="#333">
                    Clear
                  </GameButton>
                </>
              )}
              {isReady && (
                <div className="text-casino-green text-sm font-semibold">Waiting for others...</div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center">{error}</div>}
      </div>
    );
  }

  // ─── PLAYING (ROLLING) ──────────────────
  if (status === "playing" && state) {
    const shooterName = getPlayerName(state.turnOrder[state.shooterIndex]);
    const diceSum = state.dice ? state.dice[0] + state.dice[1] : null;

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Phase indicator + ON/OFF puck */}
          <div className="flex items-center gap-4 mb-4">
            <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-white/60 text-[10px] uppercase tracking-wider font-bold">
                {state.phase === "come-out" ? "Come-Out Roll" : "Point Phase"}
              </span>
            </div>
            <PointPuck point={state.point} />
          </div>

          {/* Shooter info */}
          <div className="flex items-center gap-2 mb-6">
            <PlayerAvatar playerId={state.turnOrder[state.shooterIndex]} size={32} color={getPlayerColor(state.turnOrder[state.shooterIndex])} />
            <span className="text-white/60 text-sm">
              {isShooter ? "Your roll!" : `${shooterName} is rolling...`}
            </span>
          </div>

          {/* Dice display with rolling animation */}
          <AnimatePresence mode="wait">
            {state.dice && (
              <motion.div
                key={rollKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
              >
                <RollingDice
                  dice={state.dice}
                  onComplete={() => setRollComplete(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sum display */}
          {state.dice && rollComplete && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="mb-4"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-mono text-2xl font-black"
                style={{
                  background: diceSum === 7 && state.phase === "point"
                    ? "linear-gradient(135deg, #EF4444, #DC2626)"
                    : diceSum === 7 || diceSum === 11
                    ? "linear-gradient(135deg, #4ADE80, #22C55E)"
                    : diceSum === state.point
                    ? "linear-gradient(135deg, #FFD700, #FFA500)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
                  color: diceSum === 7 && state.phase === "point" ? "#fff"
                    : diceSum === 7 || diceSum === 11 ? "#fff"
                    : diceSum === state.point ? "#000"
                    : "#fff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {diceSum}
              </div>
            </motion.div>
          )}

          {/* Mid-roll results */}
          {state.results && rollComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 w-full max-w-xs"
            >
              {state.turnOrder.map((pid) => {
                const r = state.results?.[pid];
                if (!r || (!r.result && r.amount === 0)) return null;
                return (
                  <div key={pid} className="text-center text-xs mb-1">
                    <span className="text-white/60">{pid === playerId ? "You" : getPlayerName(pid)}: </span>
                    <span style={{ color: r.amount > 0 ? "#4ADE80" : r.amount < 0 ? "#FF6B6B" : "#888" }}>
                      {r.result} {r.amount > 0 ? `+$${r.amount}` : r.amount < 0 ? `-$${Math.abs(r.amount)}` : ""}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Roll button (shooter only) */}
          {!state.dice && isShooter && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => sendAction("roll")}
              className="px-8 py-4 rounded-2xl text-lg font-bold uppercase tracking-wider"
              style={{
                background: "linear-gradient(135deg, #EF4444, #DC2626)",
                color: "#fff",
                boxShadow: "0 8px 30px rgba(239,68,68,0.4)",
              }}
            >
              Roll the Dice
            </motion.button>
          )}

          {/* Continue rolling in point phase */}
          {state.dice && rollComplete && state.phase === "point" && isShooter && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => sendAction("continue-roll")}
              className="px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider mt-2"
              style={{
                background: "linear-gradient(135deg, #EF4444, #DC2626)",
                color: "#fff",
                boxShadow: "0 8px 30px rgba(239,68,68,0.3)",
              }}
            >
              Roll Again
            </motion.button>
          )}

          {!isShooter && !state.dice && (
            <div className="text-white/40 text-sm">Waiting for {shooterName} to roll...</div>
          )}

          {!isShooter && state.dice && !rollComplete && (
            <div className="text-white/40 text-sm mt-2 animate-pulse">Rolling...</div>
          )}

          {/* Roll history */}
          {state.rollHistory.length > 0 && (
            <div className="mt-6">
              <div className="text-white/30 text-[8px] uppercase tracking-wider mb-1.5 text-center">Roll History</div>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {state.rollHistory.slice(-12).map((roll, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                    style={{
                      background: roll.sum === 7
                        ? "rgba(239,68,68,0.25)"
                        : roll.sum === state.point
                        ? "rgba(255,215,0,0.25)"
                        : "rgba(255,255,255,0.08)",
                      color: roll.sum === 7
                        ? "#FF6B6B"
                        : roll.sum === state.point
                        ? "#FFD700"
                        : "#fff",
                      border: `1px solid ${
                        roll.sum === 7 ? "#FF6B6B44"
                        : roll.sum === state.point ? "#FFD70044"
                        : "rgba(255,255,255,0.1)"
                      }`,
                    }}
                  >
                    {roll.sum}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center relative z-20">{error}</div>}
      </div>
    );
  }

  // ─── RESOLVING ──────────────────────────
  if (status === "resolving" && state) {
    const diceSum = state.dice ? state.dice[0] + state.dice[1] : null;
    const sevenOut = diceSum === 7 && state.phase !== "come-out";

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Result banner */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-4 px-6 py-2 rounded-full"
            style={{
              background: sevenOut
                ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1))"
                : "linear-gradient(135deg, rgba(74,222,128,0.3), rgba(74,222,128,0.1))",
              border: `1px solid ${sevenOut ? "#EF444444" : "#4ADE8044"}`,
            }}
          >
            <span className="text-sm font-bold" style={{ color: sevenOut ? "#FF6B6B" : "#4ADE80" }}>
              {sevenOut ? "Seven Out!" : diceSum === 7 ? "Natural 7!" : diceSum === 11 ? "Yo 11!" : diceSum === 2 ? "Snake Eyes!" : diceSum === 3 ? "Ace Deuce!" : diceSum === 12 ? "Boxcars!" : `Hit the Point ${state.point || ""}!`}
            </span>
          </motion.div>

          {/* Dice result */}
          {state.dice && (
            <div className="flex gap-5 mb-3">
              {state.dice.map((d, i) => (
                <DiceFace key={i} value={d} size={60} />
              ))}
            </div>
          )}

          {diceSum && (
            <div className="text-casino-gold font-mono text-2xl font-bold mb-4">
              {diceSum}
            </div>
          )}

          {/* All player results */}
          <div className="w-full max-w-xs space-y-2 mb-6">
            {state.turnOrder.map((pid) => {
              const result = state.results?.[pid];
              if (!result) return null;
              const isMe = pid === playerId;
              return (
                <motion.div
                  key={pid}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: isMe ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.04)",
                    border: isMe ? "1px solid rgba(255,215,0,0.2)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <PlayerAvatar playerId={pid} size={28} color={getPlayerColor(pid)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-semibold">{isMe ? "You" : getPlayerName(pid)}</div>
                    <div className="text-white/40 text-[9px] truncate">{result.result || "No bet"}</div>
                  </div>
                  <span
                    className="text-sm font-mono font-bold"
                    style={{
                      color: result.amount > 0 ? "#4ADE80" : result.amount < 0 ? "#FF6B6B" : "#888",
                    }}
                  >
                    {result.amount > 0 ? `+$${result.amount}` : result.amount < 0 ? `-$${Math.abs(result.amount)}` : "$0"}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <GameButton onClick={() => sendAction("new-round")} color="#FFD700" primary>
              New Round
            </GameButton>
            <GameButton onClick={handleLeave} color="#333">
              Leave
            </GameButton>
          </div>
        </div>

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center relative z-20">{error}</div>}
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
        src="/craps2.png"
        alt=""
        fill
        className="object-cover object-top"
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
