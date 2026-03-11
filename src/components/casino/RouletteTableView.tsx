"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Users, Coins, Check } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { RouletteGameState } from "@/lib/types";
import { CasinoTable } from "@/lib/store/casino-store";
import { useGameSession } from "@/hooks/useGameSession";
import { getNumberColor, WHEEL_ORDER } from "@/lib/roulette-logic";
import GameButton from "@/components/ui/GameButton";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import MusicButton from "@/components/ui/MusicButton";

interface RouletteTableViewProps {
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

// Standard roulette board layout: 3 columns, 12 rows
const BOARD_NUMBERS: number[][] = [];
for (let row = 0; row < 12; row++) {
  BOARD_NUMBERS.push([row * 3 + 1, row * 3 + 2, row * 3 + 3]);
}

const BET_CHIPS = [1, 10, 25, 50, 100, 250];

type BetTarget = {
  type: string;
  number?: number;
  label: string;
};

export default function RouletteTableView({
  table,
  playerId,
  onLeave,
}: RouletteTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [selectedChip, setSelectedChip] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as RouletteGameState | undefined;

  // Trigger spin animation when we enter resolving
  useEffect(() => {
    if (status === "resolving" && state?.winningNumber !== null && !showResult) {
      setSpinning(true);
      const timer = setTimeout(() => {
        setSpinning(false);
        setShowResult(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (status === "betting") {
      setShowResult(false);
      setSpinning(false);
    }
  }, [status, state?.winningNumber, showResult]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center">
        <div className="text-[#555] text-sm animate-pulse">Loading table...</div>
      </div>
    );
  }

  const myBets = state?.bets?.[playerId] || [];
  const myTotalBet = myBets.reduce((s, b) => s + b.amount, 0);
  const isReady = state?.readyPlayers?.includes(playerId) || false;
  const myResult = state?.results?.[playerId];

  // Aggregate all player bets by cell key (e.g. "straight-7", "red", "dozen1")
  const cellBets: Record<string, { playerId: number; amount: number }[]> = {};
  if (state?.bets) {
    for (const [pid, bets] of Object.entries(state.bets)) {
      for (const bet of bets) {
        const key = bet.type === "straight" ? `straight-${bet.number}` : bet.type;
        if (!cellBets[key]) cellBets[key] = [];
        const existing = cellBets[key].find((b) => b.playerId === Number(pid));
        if (existing) {
          existing.amount += bet.amount;
        } else {
          cellBets[key].push({ playerId: Number(pid), amount: bet.amount });
        }
      }
    }
  }

  function getCellKey(type: string, number?: number): string {
    return type === "straight" ? `straight-${number}` : type;
  }

  function placeBet(target: BetTarget) {
    if (isReady) return;
    sendAction("place-bet", {
      betType: target.type,
      betNumber: target.number,
      amount: selectedChip,
    });
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

          <div className="relative mx-auto mb-8" style={{ maxWidth: 600 }}>
            <div className="pt-32 pb-6">
              <div className="flex justify-center gap-4">
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
              <span className="text-white/40 text-[10px]">
                {seats.length}/{table.max_seats} seated
              </span>
            </div>
          </div>

          {seats.length >= 1 && seats.some((s) => s.player_id === playerId) && (
            <GameButton onClick={startGame} color="#FFD700" primary>
              Play
            </GameButton>
          )}

          {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── BETTING ────────────────────────────
  if (status === "betting" && state) {
    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />

        {/* Top bar */}
        <div className="relative z-30 flex items-center gap-3 px-4 py-3"
          style={{ background: "linear-gradient(180deg, rgba(6,6,16,0.8), transparent)" }}
        >
          <button
            onClick={handleLeave}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 border border-white/10"
          >
            <ArrowLeft size={14} className="text-white/60" />
          </button>
          <div className="flex-1">
            <div className="text-white text-sm font-semibold">{table.table_name}</div>
            <div className="text-white/40 text-[9px] font-mono">Place your bets</div>
          </div>
          <MusicButton />
          {/* Other players status */}
          <div className="flex gap-1">
            {state.turnOrder.filter((pid) => pid !== playerId).map((pid) => {
              const ready = state.readyPlayers.includes(pid);
              return (
                <div key={pid} className="flex flex-col items-center">
                  <PlayerAvatar playerId={pid} size={24} color={getPlayerColor(pid)} />
                  <span className={`text-[7px] ${ready ? "text-casino-green" : "text-white/30"}`}>
                    {ready ? "Ready" : "..."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roulette Board */}
        <div className="relative z-10 flex-1 overflow-auto px-2 py-2">
          <div className="max-w-2xl mx-auto">
            {/* Zero */}
            <BoardCell
              label="0"
              bg="#0a6e3a"
              className="w-full h-10 rounded-lg mb-1 text-white font-bold text-sm border border-white/20"
              bets={cellBets[getCellKey("straight", 0)]}
              currentPlayerId={playerId}
              onClick={() => placeBet({ type: "straight", number: 0, label: "0" })}
            />

            {/* Number grid */}
            <div className="grid grid-cols-3 gap-[3px] mb-1">
              {BOARD_NUMBERS.map((row) =>
                row.map((n) => {
                  const color = getNumberColor(n);
                  return (
                    <BoardCell
                      key={n}
                      label={`${n}`}
                      bg={color === "red" ? "#c0392b" : "#1a1a2e"}
                      className="h-11 rounded text-white font-bold text-sm border border-white/10"
                      bets={cellBets[getCellKey("straight", n)]}
                      currentPlayerId={playerId}
                      onClick={() => placeBet({ type: "straight", number: n, label: `${n}` })}
                    />
                  );
                })
              )}
            </div>

            {/* Column bets */}
            <div className="grid grid-cols-3 gap-[2px] mb-2">
              {[
                { type: "col1", label: "2:1" },
                { type: "col2", label: "2:1" },
                { type: "col3", label: "2:1" },
              ].map((b) => (
                <BoardCell
                  key={b.type}
                  label={b.label}
                  bg="rgba(255,255,255,0.05)"
                  className="h-8 rounded text-[10px] text-white/70 font-bold border border-white/10"
                  bets={cellBets[getCellKey(b.type)]}
                  currentPlayerId={playerId}
                  onClick={() => placeBet({ type: b.type, label: b.label })}
                />
              ))}
            </div>

            {/* Outside bets row 1 */}
            <div className="grid grid-cols-3 gap-[2px] mb-1">
              {[
                { type: "dozen1", label: "1st 12" },
                { type: "dozen2", label: "2nd 12" },
                { type: "dozen3", label: "3rd 12" },
              ].map((b) => (
                <BoardCell
                  key={b.type}
                  label={b.label}
                  bg="rgba(255,255,255,0.05)"
                  className="h-9 rounded text-[10px] text-white/70 font-bold border border-white/10"
                  bets={cellBets[getCellKey(b.type)]}
                  currentPlayerId={playerId}
                  onClick={() => placeBet({ type: b.type, label: b.label })}
                />
              ))}
            </div>

            {/* Outside bets row 2 */}
            <div className="grid grid-cols-6 gap-[2px] mb-3">
              {[
                { type: "low", label: "1-18" },
                { type: "even", label: "EVEN" },
                { type: "red", label: "RED", bg: "#c0392b" },
                { type: "black", label: "BLK", bg: "#1a1a2e" },
                { type: "odd", label: "ODD" },
                { type: "high", label: "19-36" },
              ].map((b) => (
                <BoardCell
                  key={b.type}
                  label={b.label}
                  bg={(b as { bg?: string }).bg || "rgba(255,255,255,0.05)"}
                  className="h-9 rounded text-[9px] text-white/70 font-bold border border-white/10"
                  bets={cellBets[getCellKey(b.type)]}
                  currentPlayerId={playerId}
                  onClick={() => placeBet({ type: b.type, label: b.label })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom — chip selector + actions */}
        <div
          className="relative z-20 px-4 pt-3 pb-6"
          style={{ background: "linear-gradient(0deg, rgba(6,6,16,0.95) 50%, transparent)" }}
        >
          {/* My bets summary */}
          {myBets.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins size={11} className="text-casino-gold" />
              <span className="text-casino-gold font-mono text-sm font-bold">
                ${myTotalBet} on {myBets.length} bet{myBets.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Chip selector */}
          <div className="flex gap-2 justify-center mb-3">
            {BET_CHIPS.filter((c) => c >= table.min_bet).map((amt) => (
              <motion.button
                key={amt}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedChip(amt)}
                className="w-12 h-12 rounded-full font-mono text-[11px] font-bold flex items-center justify-center"
                style={{
                  background: selectedChip === amt
                    ? "linear-gradient(135deg, #FFD700, #B8860B)"
                    : "rgba(255,255,255,0.08)",
                  color: selectedChip === amt ? "#000" : "#888",
                  border: selectedChip === amt ? "2px solid #FFD700" : "2px solid transparent",
                }}
              >
                ${amt}
              </motion.button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            {myBets.length > 0 && !isReady && (
              <GameButton onClick={() => sendAction("clear-bets")} color="#666">
                Clear
              </GameButton>
            )}
            {myBets.length > 0 && !isReady && (
              <GameButton onClick={() => sendAction("ready")} color="#34D399" primary>
                <Check size={14} className="inline mr-1" />
                Spin!
              </GameButton>
            )}
            {isReady && (
              <div className="text-casino-green text-sm font-semibold flex items-center gap-1">
                <Check size={14} /> Waiting for others...
              </div>
            )}
          </div>

          {error && <div className="mt-2 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── SPINNING / RESULTS ─────────────────
  if ((status === "resolving") && state) {
    const winNum = state.winningNumber ?? 0;
    const winColor = getNumberColor(winNum);

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />

        {/* Top bar */}
        <div className="relative z-30 flex items-center gap-3 px-4 py-3"
          style={{ background: "linear-gradient(180deg, rgba(6,6,16,0.8), transparent)" }}
        >
          <button
            onClick={handleLeave}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 border border-white/10"
          >
            <ArrowLeft size={14} className="text-white/60" />
          </button>
          <div className="flex-1">
            <div className="text-white text-sm font-semibold">{table.table_name}</div>
          </div>
          <MusicButton />
        </div>

        {/* Wheel / Result */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {spinning ? (
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Spinning numbers animation */}
              <motion.div
                className="text-6xl font-bold font-mono mb-4"
                animate={{
                  opacity: [1, 0.3, 1],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 0.3, repeat: Infinity }}
                style={{ color: "#FFD700" }}
              >
                <SpinningNumbers targetNumber={winNum} duration={3000} />
              </motion.div>
              <div className="text-white/40 text-sm uppercase tracking-[4px]">
                Spinning...
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="flex flex-col items-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              {/* Winning number */}
              <motion.div
                className="w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold font-mono mb-4 border-4"
                style={{
                  background: winColor === "red" ? "#c0392b" : winColor === "black" ? "#1a1a2e" : "#0a6e3a",
                  borderColor: "#FFD700",
                  color: "#fff",
                  boxShadow: `0 0 40px ${winColor === "red" ? "rgba(192,57,43,0.5)" : winColor === "green" ? "rgba(10,110,58,0.5)" : "rgba(26,26,46,0.5)"}`,
                }}
              >
                {winNum}
              </motion.div>

              <div className="text-white/60 text-sm uppercase tracking-wider mb-6">
                {winColor.toUpperCase()} {winNum % 2 === 0 && winNum > 0 ? "EVEN" : winNum > 0 ? "ODD" : ""}
              </div>

              {/* My result */}
              {myResult && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center mb-4"
                >
                  <span
                    className="inline-block px-5 py-2 rounded-full text-lg font-bold"
                    style={{
                      background: myResult.netAmount > 0 ? "rgba(74,222,128,0.15)" : myResult.netAmount < 0 ? "rgba(255,107,107,0.15)" : "rgba(136,136,136,0.15)",
                      color: myResult.netAmount > 0 ? "#4ADE80" : myResult.netAmount < 0 ? "#FF6B6B" : "#888",
                      border: `1px solid ${myResult.netAmount > 0 ? "#4ADE8033" : myResult.netAmount < 0 ? "#FF6B6B33" : "#88888833"}`,
                    }}
                  >
                    {myResult.netAmount > 0
                      ? `+$${myResult.netAmount}`
                      : myResult.netAmount < 0
                      ? `-$${Math.abs(myResult.netAmount)}`
                      : "Break Even"}
                  </span>
                  {myResult.winningBets.length > 0 && (
                    <div className="text-white/50 text-xs mt-2">
                      Won: {myResult.winningBets.join(", ")}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Other players results */}
              {state.results && (
                <div className="flex gap-4 justify-center mb-6">
                  {state.turnOrder.filter((pid) => pid !== playerId).map((pid) => {
                    const r = state.results?.[pid];
                    if (!r) return null;
                    return (
                      <div key={pid} className="flex flex-col items-center">
                        <PlayerAvatar playerId={pid} size={28} color={getPlayerColor(pid)} />
                        <span className="text-[8px] text-white/60">{getPlayerName(pid)}</span>
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: r.netAmount > 0 ? "#4ADE80" : r.netAmount < 0 ? "#FF6B6B" : "#888" }}
                        >
                          {r.netAmount > 0 ? `+$${r.netAmount}` : r.netAmount < 0 ? `-$${Math.abs(r.netAmount)}` : "$0"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <GameButton onClick={() => sendAction("new-round")} color="#FFD700" primary>
                  New Round
                </GameButton>
                <GameButton onClick={handleLeave} color="#333">
                  Leave
                </GameButton>
              </div>
            </motion.div>
          )}
        </div>

        {error && <div className="px-4 pb-4 text-casino-red text-xs text-center relative z-20">{error}</div>}
      </div>
    );
  }

  return null;
}

// ─── SUB-COMPONENTS ────────────────────────

function TableBg() {
  return (
    <div className="absolute inset-0 z-0">
      <Image
        src="/RouletteV2.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 20%, rgba(6,6,16,0.8) 50%, rgba(6,6,16,0.95) 100%)",
        }}
      />
    </div>
  );
}

function BoardCell({
  label,
  bg,
  className,
  bets,
  currentPlayerId,
  onClick,
}: {
  label: string;
  bg: string;
  className: string;
  bets?: { playerId: number; amount: number }[];
  currentPlayerId: number;
  onClick: () => void;
}) {
  const hasBets = bets && bets.length > 0;

  return (
    <button
      onClick={onClick}
      className={`${className} active:scale-95 transition-transform relative overflow-hidden`}
      style={{ background: bg }}
    >
      {label}
      {hasBets && (
        <div className="absolute top-0.5 right-0.5 flex flex-col items-end gap-px">
          {bets.map((b, i) => {
            const isMe = b.playerId === currentPlayerId;
            const color = isMe ? "#FFD700" : getPlayerColor(b.playerId);
            return (
              <div
                key={i}
                className="flex items-center gap-px"
              >
                <div
                  className="w-[14px] h-[14px] rounded-full flex items-center justify-center text-[6px] font-bold border"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}99)`,
                    borderColor: `${color}cc`,
                    color: isMe ? "#000" : "#fff",
                    boxShadow: `0 1px 3px ${color}44`,
                  }}
                >
                  {b.amount >= 1000 ? `${Math.floor(b.amount / 1000)}k` : b.amount}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}

function SpinningNumbers({ targetNumber, duration }: { targetNumber: number; duration: number }) {
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    let frame: number;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        setDisplay(targetNumber);
        setDone(true);
        return;
      }

      // Slow down as we approach the end
      const speed = Math.max(50, 300 * (1 - progress));
      const idx = Math.floor((elapsed / speed) % WHEEL_ORDER.length);
      setDisplay(WHEEL_ORDER[idx]);

      frame = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frame);
  }, [targetNumber, duration]);

  const color = getNumberColor(display);

  return (
    <span style={{ color: done ? "#FFD700" : color === "red" ? "#c0392b" : color === "green" ? "#0a6e3a" : "#aaa" }}>
      {display}
    </span>
  );
}
