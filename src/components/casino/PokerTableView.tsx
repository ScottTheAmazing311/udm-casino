"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Coins } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { PokerGameState, PokerPhase } from "@/lib/types";
import { CasinoTable } from "@/lib/store/casino-store";
import { useGameSession } from "@/hooks/useGameSession";
import Card from "@/components/ui/Card";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import GameButton from "@/components/ui/GameButton";
import MusicButton from "@/components/ui/MusicButton";

interface PokerTableViewProps {
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

const PHASE_LABELS: Record<PokerPhase, string> = {
  preflop: "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

export default function PokerTableView({
  table,
  playerId,
  onLeave,
}: PokerTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as PokerGameState | undefined;
  const isMyTurn = session?.current_turn_player_id === playerId;
  const myHoles = state?.playerHoles?.[playerId] || [];
  const isFolded = state?.folded?.[playerId] || false;
  const isAllIn = state?.allIn?.[playerId] || false;
  const canAct = isMyTurn && !isFolded && !isAllIn && status === "playing";

  // Determine available actions
  const myRoundBet = state?.roundBets?.[playerId] || 0;
  const currentBet = state?.currentBet || 0;
  const callAmount = currentBet - myRoundBet;
  const canCheck = myRoundBet >= currentBet;
  const canCall = callAmount > 0;
  const minRaise = currentBet * 2 || (table.min_bet || 10);

  // Turn timer
  const TURN_TIMEOUT = 30;
  const [turnTimer, setTurnTimer] = useState(TURN_TIMEOUT);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTurnTimer();
    if (canAct) {
      setTurnTimer(TURN_TIMEOUT);
      turnTimerRef.current = setInterval(() => {
        setTurnTimer((prev) => {
          if (prev <= 1) {
            clearTurnTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTurnTimer;
  }, [canAct, clearTurnTimer, session?.current_turn_player_id]);

  // Reset raise amount when it's my turn
  useEffect(() => {
    if (canAct) {
      setRaiseAmount(minRaise);
      setShowRaiseSlider(false);
    }
  }, [canAct, minRaise]);

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
              <div className="text-white/40 text-[10px] font-mono">Blinds: ${Math.floor((table.min_bet || 10) / 2)}/${table.min_bet || 10}</div>
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
              <span className="text-white/40 text-[10px]">
                {seats.length}/{table.max_seats} seated
              </span>
            </div>
          </div>

          {seats.length >= 2 && seats.some((s) => s.player_id === playerId) && (
            <GameButton onClick={startGame} color="#FFD700" primary>
              Start Hand
            </GameButton>
          )}

          {seats.length === 1 && seats.some((s) => s.player_id === playerId) && (
            <div className="text-white/40 text-xs text-center">Need at least 2 players</div>
          )}

          {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── BETTING (pre-deal) ─────────────────
  if (status === "betting" && state) {
    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden">
        <TableBg />
        <div className="relative z-10 flex flex-col min-h-screen">
          <TopBar table={table} onLeave={handleLeave} />

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-white/50 text-sm mb-4">Ready to deal?</div>
            <div className="text-white/30 text-[10px] mb-6">
              Blinds: ${Math.floor((table.min_bet || 10) / 2)} / ${table.min_bet || 10}
            </div>

            <div className="flex justify-center gap-4 mb-8">
              {state.turnOrder.map((pid) => {
                const isDealer = state.turnOrder[state.dealerIndex] === pid;
                return (
                  <div key={pid} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <PlayerAvatar playerId={pid} size={36} color={getPlayerColor(pid)} />
                      {isDealer && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-casino-gold flex items-center justify-center text-[8px] font-bold text-black">
                          D
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-white/60">{pid === playerId ? "You" : getPlayerName(pid)}</span>
                  </div>
                );
              })}
            </div>

            <GameButton onClick={() => sendAction("deal")} color="#FFD700" primary>
              Deal Cards
            </GameButton>
          </div>

          {error && <div className="px-4 pb-4 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── PLAYING / RESOLVING ────────────────
  if ((status === "playing" || status === "resolving") && state) {
    const isShowdown = state.phase === "showdown";
    const otherPlayers = state.turnOrder.filter((pid) => pid !== playerId);
    const myResult = state.results?.[playerId];

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBg />

        {/* Top bar */}
        <TopBar table={table} onLeave={handleLeave} />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Phase + Pot indicator */}
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-white/60 text-[10px] uppercase tracking-wider">
                {PHASE_LABELS[state.phase]}
              </span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-casino-gold/20 backdrop-blur-sm">
              <Coins size={10} className="text-casino-gold" />
              <span className="text-casino-gold text-xs font-mono font-bold">${state.pot}</span>
            </div>
          </div>

          {/* Other players */}
          <div className="flex justify-center gap-3 px-4 py-2 flex-wrap">
            {otherPlayers.map((pid) => (
              <PokerPlayer
                key={pid}
                pid={pid}
                state={state}
                isActive={session?.current_turn_player_id === pid && status === "playing"}
                isShowdown={isShowdown}
                isDealer={state.turnOrder[state.dealerIndex] === pid}
              />
            ))}
          </div>

          {/* Community cards */}
          <div className="flex flex-col items-center py-4">
            <div className="flex gap-2 min-h-[80px] items-center">
              {state.communityCards.length === 0 && status === "playing" && (
                <div className="text-white/20 text-xs">Waiting for community cards...</div>
              )}
              {state.communityCards.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ y: -30, opacity: 0, rotateY: 180 }}
                  animate={{ y: 0, opacity: 1, rotateY: 0 }}
                  transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
                >
                  <Card card={c} delay={0} small />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* My hand area */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative z-20 px-4 pt-3 pb-4"
            style={{ background: "linear-gradient(0deg, rgba(6,6,16,0.95) 50%, transparent)" }}
          >
            {/* My status */}
            {isFolded && (
              <div className="text-center mb-2">
                <span className="text-white/30 text-xs uppercase tracking-wider">Folded</span>
              </div>
            )}

            {isAllIn && !isFolded && (
              <div className="text-center mb-2">
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-casino-gold text-xs uppercase tracking-wider font-bold"
                >
                  All In
                </motion.span>
              </div>
            )}

            {/* Turn indicator + timer */}
            {canAct && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-casino-gold text-[10px] uppercase tracking-[3px] font-bold"
                >
                  Your Turn
                </motion.div>
                <div
                  className="text-[11px] font-mono font-bold tabular-nums"
                  style={{ color: turnTimer <= 10 ? "#FF6B6B" : "#FFD700" }}
                >
                  {turnTimer}s
                </div>
              </div>
            )}

            {/* My hole cards */}
            {myHoles.length > 0 && (
              <div className="flex justify-center gap-2 mb-2">
                {myHoles.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ y: 40, opacity: 0, rotate: -5 + i * 5 }}
                    animate={{
                      y: 0,
                      opacity: isFolded ? 0.3 : 1,
                      rotate: -3 + i * 3,
                    }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                  >
                    <Card card={c} delay={0} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* My bet */}
            {(state.bets[playerId] || 0) > 0 && (
              <div className="flex justify-center mb-2">
                <div className="flex items-center gap-1 text-casino-gold text-xs font-mono">
                  <Coins size={11} />
                  ${state.bets[playerId]}
                </div>
              </div>
            )}

            {/* Result banner */}
            <AnimatePresence>
              {myResult && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center mb-2"
                >
                  <span
                    className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
                    style={{
                      background: myResult.amount > 0 ? "rgba(74,222,128,0.15)" : myResult.amount < 0 ? "rgba(255,107,107,0.15)" : "rgba(136,136,136,0.15)",
                      color: myResult.amount > 0 ? "#4ADE80" : myResult.amount < 0 ? "#FF6B6B" : "#888",
                      border: `1px solid ${myResult.amount > 0 ? "#4ADE8033" : myResult.amount < 0 ? "#FF6B6B33" : "#88888833"}`,
                    }}
                  >
                    {myResult.hand}{" "}
                    {myResult.amount > 0
                      ? `+$${myResult.amount}`
                      : myResult.amount < 0
                      ? `-$${Math.abs(myResult.amount)}`
                      : ""}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <AnimatePresence>
              {canAct && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="space-y-2"
                >
                  <div className="flex gap-2 justify-center">
                    <ActionButton label="Fold" color="#EF4444" onClick={() => sendAction("fold")} />
                    {canCheck && (
                      <ActionButton label="Check" color="#60A5FA" onClick={() => sendAction("check")} />
                    )}
                    {canCall && (
                      <ActionButton label={`Call $${callAmount}`} color="#34D399" onClick={() => sendAction("call")} />
                    )}
                    <ActionButton
                      label="Raise"
                      color="#F59E0B"
                      onClick={() => setShowRaiseSlider(!showRaiseSlider)}
                    />
                    <ActionButton label="All In" color="#A78BFA" onClick={() => sendAction("all-in")} />
                  </div>

                  {/* Raise slider */}
                  <AnimatePresence>
                    {showRaiseSlider && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex items-center gap-3 justify-center overflow-hidden"
                      >
                        <input
                          type="range"
                          min={minRaise}
                          max={1000}
                          step={table.min_bet || 10}
                          value={raiseAmount}
                          onChange={(e) => setRaiseAmount(Number(e.target.value))}
                          className="w-40 accent-casino-gold"
                        />
                        <span className="text-white font-mono text-sm w-16 text-center">${raiseAmount}</span>
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => {
                            sendAction("raise", { amount: raiseAmount });
                            setShowRaiseSlider(false);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase"
                          style={{
                            background: "linear-gradient(135deg, #F59E0B, #D97706)",
                            color: "#fff",
                          }}
                        >
                          Raise
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results actions */}
            {status === "resolving" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 justify-center mt-2"
              >
                <GameButton onClick={() => sendAction("new-round")} color="#FFD700" primary>
                  New Hand
                </GameButton>
                <GameButton onClick={handleLeave} color="#333">
                  Leave
                </GameButton>
              </motion.div>
            )}
          </motion.div>

          {error && <div className="px-4 pb-2 text-casino-red text-xs text-center relative z-20">{error}</div>}
        </div>
      </div>
    );
  }

  return null;
}

// ─── SUB-COMPONENTS ──────────────────────

function PokerPlayer({
  pid,
  state,
  isActive,
  isDealer,
}: {
  pid: number;
  state: PokerGameState;
  isActive: boolean;
  isShowdown?: boolean;
  isDealer: boolean;
}) {
  const folded = state.folded[pid];
  const allIn = state.allIn[pid];
  const holes = state.playerHoles[pid] || [];
  const result = state.results?.[pid];
  const color = getPlayerColor(pid);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: folded ? 0.4 : 1, y: 0 }}
      className="flex flex-col items-center gap-1 min-w-[70px]"
    >
      {/* Avatar */}
      <div className="relative">
        <PlayerAvatar playerId={pid} size={28} color={color} active={isActive} />
        {isActive && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-casino-gold"
          />
        )}
        {isDealer && (
          <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-casino-gold flex items-center justify-center text-[7px] font-bold text-black">
            D
          </div>
        )}
      </div>
      <span className="text-[8px] text-white/60 font-medium">{getPlayerName(pid)}</span>

      {/* Cards */}
      <div className="flex gap-0.5">
        {holes.map((c, i) => {
          const isHidden = c.rank === "?" && c.suit === "?";
          return (
            <div
              key={`${pid}-${i}`}
              className="w-[22px] h-[30px] rounded-[3px] overflow-hidden flex-shrink-0"
              style={{
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                transform: `rotate(${-2 + i * 2}deg)`,
              }}
            >
              {isHidden ? (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700" />
              ) : (
                <Image
                  src={`/cards/${c.rank === "10" ? "10" : c.rank}${{ "♠": "S", "♥": "H", "♦": "D", "♣": "C" }[c.suit] || "S"}.png`}
                  alt=""
                  width={22}
                  height={30}
                  className="object-cover w-full h-full"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status badges */}
      {folded && <span className="text-[7px] text-white/30 uppercase">Folded</span>}
      {allIn && !folded && (
        <span className="text-[7px] text-casino-gold font-bold uppercase">All In</span>
      )}

      {/* Bet */}
      {(state.bets[pid] || 0) > 0 && !folded && (
        <span className="text-[7px] text-casino-gold/60 font-mono">${state.bets[pid]}</span>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="text-[7px] text-white/60">{result.hand}</div>
          <span
            className="text-[8px] font-bold"
            style={{ color: result.amount > 0 ? "#4ADE80" : result.amount < 0 ? "#FF6B6B" : "#888" }}
          >
            {result.amount > 0 ? `+$${result.amount}` : result.amount < 0 ? `-$${Math.abs(result.amount)}` : "Break Even"}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

function TableBg() {
  return (
    <div className="absolute inset-0 z-0">
      <Image
        src="/poker2.png"
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
        <div className="text-white/40 text-[9px] font-mono">
          Blinds: ${Math.floor((table.min_bet || 10) / 2)}/${table.min_bet || 10}
        </div>
      </div>
      <MusicButton />
    </div>
  );
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: "#fff",
        boxShadow: `0 4px 20px ${color}44`,
        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }}
    >
      {label}
    </motion.button>
  );
}
