"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Users, Dice5 } from "lucide-react";
import { useState } from "react";
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

const DICE_FACES: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

export default function CrapsTableView({
  table,
  playerId,
  onLeave,
}: CrapsTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [selectedBetType, setSelectedBetType] = useState<CrapsBetType>("pass");

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

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden">
        <TableBg />
        <div className="relative z-10 flex flex-col min-h-screen">
          <TopBar table={table} onLeave={handleLeave} />

          <div className="flex-1 flex flex-col px-4 py-2">
            {/* Shooter indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <Dice5 size={14} className="text-casino-gold" />
              <span className="text-white/60 text-xs">
                Shooter: <span className="text-casino-gold font-bold">{isShooter ? "You" : shooterName}</span>
              </span>
            </div>

            {/* Point indicator */}
            {state.point && (
              <div className="flex items-center justify-center mb-3">
                <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                  <span className="text-white/60 text-xs">Point: </span>
                  <span className="text-casino-gold font-mono font-bold text-lg">{state.point}</span>
                </div>
              </div>
            )}

            {/* Other players' status */}
            {otherPlayers.length > 0 && (
              <div className="flex justify-center gap-4 mb-4">
                {otherPlayers.map((pid) => {
                  const hasBets = (state.bets[pid] || []).length > 0;
                  const ready = state.readyPlayers.includes(pid);
                  return (
                    <div key={pid} className="flex flex-col items-center gap-1">
                      <PlayerAvatar playerId={pid} size={28} color={getPlayerColor(pid)} />
                      <span className="text-[8px] text-white/60">{getPlayerName(pid)}</span>
                      <span className={`text-[7px] font-bold ${ready ? "text-casino-green" : hasBets ? "text-casino-gold" : "text-white/30"}`}>
                        {ready ? "Ready" : hasBets ? "Betting" : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bet type selector */}
            <div className="mb-3">
              <div className="text-white/40 text-[9px] uppercase tracking-wider mb-2 text-center">Select Bet</div>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {BET_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.type}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedBetType(opt.type)}
                    className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      background: selectedBetType === opt.type ? `${opt.color}30` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${selectedBetType === opt.type ? opt.color : "rgba(255,255,255,0.1)"}`,
                      color: selectedBetType === opt.type ? opt.color : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </div>
              <div className="text-white/30 text-[8px] text-center mt-1">
                {BET_OPTIONS.find((o) => o.type === selectedBetType)?.desc}
              </div>
            </div>

            {/* Bet amount chips */}
            {!isReady && (
              <div className="mb-3">
                <div className="flex gap-2 justify-center">
                  {BET_AMOUNTS
                    .filter((amt) => amt >= table.min_bet && amt <= table.max_bet)
                    .map((amt) => (
                      <motion.button
                        key={amt}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => sendAction("place-bet", { betType: selectedBetType, amount: amt })}
                        className="w-12 h-12 rounded-full font-mono text-xs font-bold flex items-center justify-center"
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
            <div className="flex gap-2 justify-center mt-auto pb-6">
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

          {error && <div className="px-4 pb-4 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── PLAYING (ROLLING) ──────────────────
  if (status === "playing" && state) {
    const shooterName = getPlayerName(state.turnOrder[state.shooterIndex]);

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Phase indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-white/60 text-[10px] uppercase tracking-wider">
                {state.phase === "come-out" ? "Come-Out Roll" : "Point Phase"}
              </span>
            </div>
            {state.point && (
              <div className="px-3 py-1 rounded-full bg-casino-gold/20 backdrop-blur-sm">
                <span className="text-casino-gold text-xs font-mono font-bold">Point: {state.point}</span>
              </div>
            )}
          </div>

          {/* Shooter info */}
          <div className="flex items-center gap-2 mb-6">
            <PlayerAvatar playerId={state.turnOrder[state.shooterIndex]} size={32} color={getPlayerColor(state.turnOrder[state.shooterIndex])} />
            <span className="text-white/60 text-sm">
              {isShooter ? "Your roll!" : `${shooterName} is rolling...`}
            </span>
          </div>

          {/* Dice display */}
          {state.dice && (
            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex gap-4 mb-4"
            >
              {state.dice.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -100, rotate: Math.random() * 360 }}
                  animate={{ y: 0, rotate: 0 }}
                  transition={{ delay: i * 0.15, type: "spring", stiffness: 150 }}
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl"
                  style={{
                    background: "linear-gradient(135deg, #fff, #e0e0e0)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  {DICE_FACES[d]}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Sum */}
          {state.dice && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-casino-gold font-mono text-3xl font-bold mb-4"
            >
              {state.dice[0] + state.dice[1]}
            </motion.div>
          )}

          {/* Mid-roll results */}
          {state.results && state.phase === "point" && (
            <div className="mb-4">
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
            </div>
          )}

          {/* Roll button (shooter only) or continue */}
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
              🎲 Roll the Dice
            </motion.button>
          )}

          {state.dice && state.phase === "point" && isShooter && (
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
              🎲 Roll Again
            </motion.button>
          )}

          {!isShooter && !state.dice && (
            <div className="text-white/40 text-sm">Waiting for {shooterName} to roll...</div>
          )}

          {/* Roll history */}
          {state.rollHistory.length > 0 && (
            <div className="mt-6">
              <div className="text-white/30 text-[8px] uppercase tracking-wider mb-1 text-center">Roll History</div>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {state.rollHistory.slice(-10).map((roll, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                    style={{
                      background: roll.sum === 7 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
                      color: roll.sum === 7 ? "#FF6B6B" : "#fff",
                      border: `1px solid ${roll.sum === 7 ? "#FF6B6B33" : "rgba(255,255,255,0.1)"}`,
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
    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
          {/* Dice result */}
          {state.dice && (
            <div className="flex gap-4 mb-3">
              {state.dice.map((d, i) => (
                <div
                  key={i}
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                  style={{
                    background: "linear-gradient(135deg, #fff, #e0e0e0)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                  }}
                >
                  {DICE_FACES[d]}
                </div>
              ))}
            </div>
          )}

          {state.dice && (
            <div className="text-casino-gold font-mono text-2xl font-bold mb-4">
              {state.dice[0] + state.dice[1]}
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
