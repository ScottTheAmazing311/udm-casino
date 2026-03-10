"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Coins } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";
import { handValue } from "@/lib/game-logic";
import { BlackjackGameState } from "@/lib/types";
import { CasinoTable, useCasinoStore } from "@/lib/store/casino-store";
import { useGameSession } from "@/hooks/useGameSession";
import Card from "@/components/ui/Card";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import GameButton from "@/components/ui/GameButton";
import MusicButton from "@/components/ui/MusicButton";
import ColbyTrainer from "@/components/games/ColbyTrainer";
import RouletteTableView from "./RouletteTableView";
import SlotsTableView from "./SlotsTableView";
import PokerTableView from "./PokerTableView";
import CrapsTableView from "./CrapsTableView";
import PlayerChipsSidebar from "./PlayerChipsSidebar";
import ChatSidebar from "./ChatSidebar";

interface GameTableViewProps {
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

const GAME_MUSIC: Record<string, string> = {
  blackjack: "/backroom-shuffle.mp3",
  roulette: "/Velvet Chips & Silver Coins.mp3",
  craps: "/Pixel High Rollers.mp3",
};

export default function GameTableView({
  table,
  playerId,
  onLeave,
}: GameTableViewProps) {
  const pName = getPlayerName(playerId);
  const { playMusic } = useCasinoStore();

  // Switch music when entering a game table
  useEffect(() => {
    const track = GAME_MUSIC[table.game_type] || "/pixel-jackpot.mp3";
    playMusic(track);
    return () => {
      // Restore lobby music when leaving
      playMusic("/pixel-jackpot.mp3");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.game_type]);

  // Dispatch to roulette view
  if (table.game_type === "roulette") {
    return (
      <>
        <RouletteTableView table={table} playerId={playerId} onLeave={onLeave} />
        <ChatSidebar playerId={playerId} playerName={pName} chatContext={table.id} />
        <PlayerChipsSidebar currentPlayerId={playerId} />
      </>
    );
  }

  // Dispatch to poker view
  if (table.game_type === "poker") {
    return (
      <>
        <PokerTableView table={table} playerId={playerId} onLeave={onLeave} />
        <ChatSidebar playerId={playerId} playerName={pName} chatContext={table.id} />
        <PlayerChipsSidebar currentPlayerId={playerId} />
      </>
    );
  }

  // Dispatch to craps view
  if (table.game_type === "craps") {
    return (
      <>
        <CrapsTableView table={table} playerId={playerId} onLeave={onLeave} />
        <ChatSidebar playerId={playerId} playerName={pName} chatContext={table.id} />
        <PlayerChipsSidebar currentPlayerId={playerId} />
      </>
    );
  }

  // Dispatch to slots view
  if (table.game_type === "slots") {
    return (
      <>
        <SlotsTableView table={table} playerId={playerId} onLeave={onLeave} />
        <ChatSidebar playerId={playerId} playerName={pName} chatContext={table.id} />
        <PlayerChipsSidebar currentPlayerId={playerId} />
      </>
    );
  }

  return (
    <>
      <BlackjackTableView table={table} playerId={playerId} onLeave={onLeave} />
      <ChatSidebar playerId={playerId} playerName={pName} chatContext={table.id} />
      <PlayerChipsSidebar currentPlayerId={playerId} />
    </>
  );
}

function BlackjackTableView({
  table,
  playerId,
  onLeave,
}: GameTableViewProps) {
  const { session, seats, loading, error, sendAction, startGame, leaveTable } =
    useGameSession(table.id, playerId);
  const [showTrainer, setShowTrainer] = useState(false);

  const handleLeave = async () => {
    await leaveTable();
    onLeave();
  };

  const status = session?.status || "waiting";
  const state = session?.game_state as BlackjackGameState | undefined;
  const isMyTurn = session?.current_turn_player_id === playerId;
  const myHand = state?.playerHands?.[playerId];
  const isMyTurnPlaying = isMyTurn && status === "playing" && myHand?.status === "playing";
  const isBettingPhase = status === "betting" && !state?.bets?.[playerId];

  // Auto-stand timer (15 seconds)
  const TURN_TIMEOUT = 15;
  const [turnTimer, setTurnTimer] = useState(TURN_TIMEOUT);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStandFired = useRef(false);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTurnTimer();
    autoStandFired.current = false;

    if (isMyTurnPlaying) {
      setTurnTimer(TURN_TIMEOUT);
      turnTimerRef.current = setInterval(() => {
        setTurnTimer((prev) => {
          if (prev <= 1) {
            clearTurnTimer();
            if (!autoStandFired.current) {
              autoStandFired.current = true;
              sendAction("stand");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return clearTurnTimer;
  }, [isMyTurnPlaying, sendAction, clearTurnTimer]);

  // Betting timer (30 seconds) — skip hand if no bet placed
  const BET_TIMEOUT = 30;
  const [betTimer, setBetTimer] = useState(BET_TIMEOUT);
  const betTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoBetSkipFired = useRef(false);

  const clearBetTimer = useCallback(() => {
    if (betTimerRef.current) {
      clearInterval(betTimerRef.current);
      betTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearBetTimer();
    autoBetSkipFired.current = false;

    if (isBettingPhase) {
      setBetTimer(BET_TIMEOUT);
      betTimerRef.current = setInterval(() => {
        setBetTimer((prev) => {
          if (prev <= 1) {
            clearBetTimer();
            if (!autoBetSkipFired.current) {
              autoBetSkipFired.current = true;
              leaveTable();
              onLeave();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return clearBetTimer;
  }, [isBettingPhase, leaveTable, onLeave, clearBetTimer]);

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
        <TableBackground gameType={table.game_type} />

        <div className="relative z-10 p-6">
          {/* Header */}
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

          {/* Seat spots overlaid on the table image */}
          <div className="relative mx-auto mb-8" style={{ maxWidth: 380 }}>
            {/* Seats positioned over the table felt */}
            <div className="pt-32 pb-6">
              <div className="flex justify-center gap-4">
                {Array.from({ length: Math.min(table.max_seats, 6) }).map((_, i) => {
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

          {/* Seated list */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-white/40" />
              <span className="text-white/40 text-[10px]">
                {seats.length}/{table.max_seats} seated
              </span>
            </div>
          </div>

          {/* Start */}
          {seats.length >= 1 && seats.some((s) => s.player_id === playerId) && (
            <GameButton onClick={startGame} color="#FFD700" primary>
              Deal Cards
            </GameButton>
          )}

          {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── BETTING ────────────────────────────
  if (status === "betting" && state) {
    const hasBet = state.bets[playerId];
    const otherPlayers = state.turnOrder.filter((pid) => pid !== playerId);

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden">
        <TableBackground gameType={table.game_type} />
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Top bar */}
          <TopBar table={table} onLeave={handleLeave} />

          {/* Table area with other players */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Other players betting status */}
            {otherPlayers.length > 0 && (
              <div className="flex justify-center gap-6 mb-6">
                {otherPlayers.map((pid) => {
                  const hasBetted = !!state.bets[pid];
                  return (
                    <div key={pid} className="flex flex-col items-center gap-1">
                      <PlayerAvatar playerId={pid} size={32} color={getPlayerColor(pid)} />
                      <span className="text-[9px] text-white/60 drop-shadow">{getPlayerName(pid)}</span>
                      <span className={`text-[8px] font-bold ${hasBetted ? "text-casino-green" : "text-white/30"}`}>
                        {hasBetted ? "Ready" : "..."}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-white/30 text-[8px] uppercase tracking-[2px]">Waiting for bets</div>
          </div>

          {/* My betting area - bottom */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-5 pb-8"
            style={{ background: "linear-gradient(0deg, rgba(6,6,16,0.95) 40%, transparent)" }}
          >
            {!hasBet ? (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-white/50 text-xs">Place your bet</span>
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: betTimer <= 10 ? "#FF6B6B" : "#FFD700" }}
                  >
                    {betTimer}s
                  </span>
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  {[25, 50, 100, 250, 500]
                    .filter((amt) => amt >= table.min_bet && amt <= table.max_bet)
                    .map((amt) => (
                      <motion.button
                        key={amt}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => sendAction("bet", { amount: amt })}
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
              </div>
            ) : (
              <div className="text-center">
                <div className="text-casino-green text-sm font-semibold mb-1">Bet placed</div>
                <div className="text-casino-gold font-mono text-lg font-bold">${state.bets[playerId]}</div>
              </div>
            )}
          </motion.div>

          {error && <div className="px-4 pb-4 text-casino-red text-xs text-center">{error}</div>}
        </div>
      </div>
    );
  }

  // ─── PLAYING / RESOLVING (POV TABLE) ────────────────────
  if ((status === "playing" || status === "resolving") && state) {
    const showDealerFull = status === "resolving";
    const dVal = state.dealerHand.length > 0 ? handValue(state.dealerHand) : 0;
    const myCards = myHand?.cards || [];
    const myVal = handValue(myCards);
    const hasSplit = !!myHand?.splitHand;
    const mySplitCards = myHand?.splitHand || [];
    const mySplitVal = hasSplit ? handValue(mySplitCards) : 0;
    const playingSplitHand = myHand?.activeSplit || false;
    const canSplit = myCards.length === 2 && !hasSplit && myHand?.status === "playing" && (() => {
      const rankVal = (r: string) => ["10", "J", "Q", "K"].includes(r) ? 10 : r;
      return rankVal(myCards[0].rank) === rankVal(myCards[1].rank);
    })();
    const otherPlayers = state.turnOrder.filter((pid) => pid !== playerId);
    const leftPlayers = otherPlayers.filter((_, i) => i % 2 === 0);
    const rightPlayers = otherPlayers.filter((_, i) => i % 2 === 1);
    const myResult = state.results?.[playerId];

    return (
      <div className="min-h-screen bg-[#060610] relative overflow-hidden flex flex-col">
        <TableBackground gameType={table.game_type} />

        {/* Top bar */}
        <TopBar table={table} onLeave={handleLeave} />

        {/* Main table area */}
        <div className="relative z-10 flex-1 flex flex-col">

          {/* DEALER CARDS — positioned on the table felt area */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center pt-[50vh] pb-1"
          >
            {/* Dealer cards on the felt */}
            <div className="flex gap-1.5 mb-1.5">
              {state.dealerHand.map((c, i) => (
                <Card key={c.id} card={c} faceDown={!showDealerFull && i === 1} delay={i * 0.15} small />
              ))}
            </div>
            {(showDealerFull || state.dealerHand.length > 0) && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono text-sm font-bold drop-shadow-lg"
                style={{ color: showDealerFull && dVal > 21 ? "#FF6B6B" : "#fff" }}
              >
                {showDealerFull ? (dVal > 21 ? "BUST" : dVal) : handValue([state.dealerHand[0]])}
              </motion.div>
            )}
          </motion.div>

          {/* TABLE FELT SURFACE — middle section with side players */}
          <div className="flex-1 relative px-2">
            {/* Side players */}
            <div className="relative z-10 flex justify-between h-full px-1 pt-4">
              {/* Left side players */}
              <div className="flex flex-col gap-3 w-[90px]">
                {leftPlayers.map((pid) => (
                  <SidePlayer
                    key={pid}
                    pid={pid}
                    hand={state.playerHands[pid]}
                    isActive={status === "playing" && session?.current_turn_player_id === pid}
                    result={state.results?.[pid]}
                    bet={state.bets[pid]}
                    side="left"
                  />
                ))}
              </div>

              {/* Center — empty space */}
              <div className="flex-1" />

              {/* Right side players */}
              <div className="flex flex-col gap-3 w-[90px]">
                {rightPlayers.map((pid) => (
                  <SidePlayer
                    key={pid}
                    pid={pid}
                    hand={state.playerHands[pid]}
                    isActive={status === "playing" && session?.current_turn_player_id === pid}
                    result={state.results?.[pid]}
                    bet={state.bets[pid]}
                    side="right"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* MY HAND — bottom, prominent POV, positioned over the betting spots */}
          {myHand && (
            <motion.div
              layout
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-20 px-4 pt-3 pb-2"
              style={{
                background: "linear-gradient(0deg, rgba(6,6,16,0.9) 50%, transparent)",
              }}
            >
              {/* Turn indicator with timer */}
              {isMyTurn && myHand.status === "playing" && (
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
                    style={{ color: turnTimer <= 5 ? "#FF6B6B" : "#FFD700" }}
                  >
                    {turnTimer}s
                  </div>
                </div>
              )}

              {/* Cards + value */}
              <div className={`flex items-end justify-center gap-${hasSplit ? "4" : "2"} mb-2`}>
                {/* Main hand */}
                <div className={`flex flex-col items-center ${hasSplit && !playingSplitHand && myHand.status === "playing" ? "ring-2 ring-casino-gold rounded-xl p-1" : hasSplit ? "opacity-60 p-1" : ""}`}>
                  {hasSplit && <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Hand 1</div>}
                  <div className="flex gap-1.5">
                    {myCards.map((c, i) => (
                      <motion.div
                        key={c.id}
                        initial={{ y: 40, opacity: 0, rotate: -5 + i * 3 }}
                        animate={{ y: 0, opacity: 1, rotate: -3 + i * 3 }}
                        transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                      >
                        <Card card={c} delay={0} small={hasSplit} />
                      </motion.div>
                    ))}
                  </div>
                  <motion.div
                    key={myVal}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`font-mono ${hasSplit ? "text-lg" : "text-2xl"} font-extrabold mt-1 drop-shadow-lg`}
                    style={{
                      color: myHand.status === "bust" ? "#FF6B6B" : myVal === 21 ? "#FFD700" : "#fff",
                      textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    }}
                  >
                    {myHand.status === "bust" ? "BUST" : myVal}
                  </motion.div>
                </div>

                {/* Split hand */}
                {hasSplit && (
                  <div className={`flex flex-col items-center ${playingSplitHand && myHand.splitStatus === "playing" ? "ring-2 ring-casino-gold rounded-xl p-1" : "opacity-60 p-1"}`}>
                    <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Hand 2</div>
                    <div className="flex gap-1.5">
                      {mySplitCards.map((c, i) => (
                        <motion.div
                          key={c.id}
                          initial={{ y: 40, opacity: 0, rotate: -5 + i * 3 }}
                          animate={{ y: 0, opacity: 1, rotate: -3 + i * 3 }}
                          transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                        >
                          <Card card={c} delay={0} small />
                        </motion.div>
                      ))}
                    </div>
                    <motion.div
                      key={mySplitVal}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="font-mono text-lg font-extrabold mt-1 drop-shadow-lg"
                      style={{
                        color: myHand.splitStatus === "bust" ? "#FF6B6B" : mySplitVal === 21 ? "#FFD700" : "#fff",
                        textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {myHand.splitStatus === "bust" ? "BUST" : mySplitVal}
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Bet display */}
              <div className="flex justify-center mb-2">
                <div className="flex items-center gap-1 text-casino-gold text-xs font-mono">
                  <Coins size={11} />
                  ${state.bets[playerId]?.toLocaleString()}
                </div>
              </div>

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
                      {myResult.result}{" "}
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
                {isMyTurn && myHand.status === "playing" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="flex gap-2 justify-center"
                  >
                    <ActionButton label="Hit" color="#34D399" onClick={() => sendAction("hit")} />
                    <ActionButton label="Stand" color="#60A5FA" onClick={() => sendAction("stand")} />
                    {myCards.length === 2 && !hasSplit && (
                      <ActionButton label="Double" color="#F59E0B" onClick={() => sendAction("double")} />
                    )}
                    {canSplit && (
                      <ActionButton label="Split" color="#A78BFA" onClick={() => sendAction("split")} />
                    )}
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
                    New Round
                  </GameButton>
                  <GameButton onClick={handleLeave} color="#333">
                    Leave
                  </GameButton>
                </motion.div>
              )}
            </motion.div>
          )}

          {error && <div className="px-4 pb-2 text-casino-red text-xs text-center relative z-20">{error}</div>}
        </div>

        {/* Colby Trainer */}
        <ColbyTrainer
          playerCards={myCards}
          dealerUpcard={state.dealerHand.length > 0 ? state.dealerHand[0] : null}
          isActive={isMyTurn && myHand?.status === "playing"}
          visible={showTrainer}
          onToggle={() => setShowTrainer(!showTrainer)}
        />
      </div>
    );
  }

  return null;
}

// ─── SUB-COMPONENTS ────────────────────────

// Map game types to their background images
const GAME_BACKGROUNDS: Record<string, string> = {
  blackjack: "/blackjack2.png",
  poker: "/poker2.png",
  craps: "/craps-table-bg.png",
  roulette: "/roulette.png",
  slots: "/slots-bg.png",
};

function TableBackground({ gameType }: { gameType: string }) {
  const bgSrc = GAME_BACKGROUNDS[gameType] || "/blackjack2.png";

  return (
    <div className="absolute inset-0 z-0">
      <Image
        src={bgSrc}
        alt=""
        fill
        className="object-cover object-top"
        priority
      />
      {/* Vignette overlay for readability */}
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
    <div className="relative z-30 flex items-center gap-3 px-4 py-3"
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

function SidePlayer({
  pid,
  hand,
  isActive,
  result,
  bet,
  side,
}: {
  pid: number;
  hand?: { cards: { suit: string; rank: string; id: string }[]; status: string };
  isActive: boolean;
  result?: { result: string; amount: number };
  bet?: number;
  side: "left" | "right";
}) {
  if (!hand) return null;
  const val = handValue(hand.cards);
  const color = getPlayerColor(pid);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center"
    >
      {/* Avatar */}
      <div className="relative mb-1">
        <PlayerAvatar playerId={pid} size={28} color={color} active={isActive} />
        {isActive && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-casino-gold"
          />
        )}
      </div>
      <span className="text-[8px] text-white/60 font-medium mb-1 drop-shadow">{getPlayerName(pid)}</span>

      {/* Mini cards */}
      <div className="flex gap-0.5 mb-0.5">
        {hand.cards.map((c, i) => (
          <div
            key={c.id}
            className="w-[22px] h-[30px] rounded-[3px] overflow-hidden flex-shrink-0"
            style={{
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              transform: `rotate(${-2 + i * 2}deg)`,
            }}
          >
            <Image
              src={`/cards/${c.rank === "10" ? "10" : c.rank}${{ "♠": "S", "♥": "H", "♦": "D", "♣": "C" }[c.suit] || "S"}.png`}
              alt=""
              width={22}
              height={30}
              className="object-cover w-full h-full"
            />
          </div>
        ))}
      </div>

      {/* Value */}
      <span
        className="font-mono text-xs font-bold drop-shadow-lg"
        style={{ color: hand.status === "bust" ? "#FF6B6B" : val === 21 ? "#FFD700" : "#fff" }}
      >
        {val}
      </span>

      {/* Bet */}
      {bet && (
        <span className="text-[8px] text-casino-gold/60 font-mono">${bet}</span>
      )}

      {/* Result */}
      {result && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-[8px] font-bold mt-0.5"
          style={{ color: result.amount > 0 ? "#4ADE80" : result.amount < 0 ? "#FF6B6B" : "#888" }}
        >
          {result.amount > 0 ? `+$${result.amount}` : result.amount < 0 ? `-$${Math.abs(result.amount)}` : "Push"}
        </motion.span>
      )}
    </motion.div>
  );
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider"
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
