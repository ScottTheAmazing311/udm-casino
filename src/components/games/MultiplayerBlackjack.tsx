"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Check, Users } from "lucide-react";
import { useState } from "react";
import { Player } from "@/lib/types";
import { PLAYERS } from "@/lib/constants";
import { handValue } from "@/lib/game-logic";
import { useMultiplayerTable } from "@/lib/useMultiplayerTable";
import Card from "@/components/ui/Card";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import ChipStack from "@/components/ui/ChipStack";
import GameButton from "@/components/ui/GameButton";
import ColbyTrainer from "./ColbyTrainer";

interface MultiplayerBlackjackProps {
  tableId: string;
  joinCode: string;
  playerId: number;
  isHost: boolean;
  goBack: () => void;
}

function getPlayer(id: number): Player {
  return PLAYERS.find((p) => p.id === id) || PLAYERS[0];
}

export default function MultiplayerBlackjack({
  tableId,
  joinCode,
  playerId,
  isHost,
  goBack,
}: MultiplayerBlackjackProps) {
  const { seats, gameState, loading, error, sendAction } = useMultiplayerTable(tableId, playerId);
  const [copied, setCopied] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeatChips = (pid: number): number => {
    const seat = seats.find((s) => s.player_id === pid);
    return seat?.chips ?? 1000;
  };

  const startRound = async () => {
    await fetch("/api/game/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, playerId }),
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-[#555] text-sm animate-pulse">Loading table...</div>
      </div>
    );
  }

  const phase = gameState?.phase || "waiting";
  const state = gameState?.state;
  const isMyTurn = gameState?.currentTurnPlayerId === playerId;

  // ─── WAITING FOR PLAYERS ────────────────────
  if (phase === "waiting") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <GameButton onClick={goBack} color="#333">
            <ArrowLeft size={16} className="inline mr-1" />
            Leave
          </GameButton>
          <h2 className="text-[22px] font-bold text-white">Blackjack Table</h2>
        </div>

        {/* Join Code */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 p-5 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.03))",
            border: "1px solid rgba(255,215,0,0.15)",
          }}
        >
          <div className="text-[#888] text-[11px] uppercase tracking-[2px] mb-2">Join Code</div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-casino-gold text-3xl font-mono font-bold tracking-[6px]">
              {joinCode}
            </span>
            <button
              onClick={copyCode}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)" }}
            >
              {copied ? <Check size={14} className="text-casino-green" /> : <Copy size={14} className="text-casino-gold" />}
            </button>
          </div>
          <div className="text-[#555] text-[11px] mt-2">Share this code with friends</div>
        </motion.div>

        {/* Seated Players */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-[#888]" />
            <span className="text-[#888] text-xs">{seats.length} player{seats.length !== 1 ? "s" : ""} seated</span>
          </div>
          <div className="flex flex-col gap-2">
            {seats.map((seat, i) => {
              const p = getPlayer(seat.player_id);
              return (
                <motion.div
                  key={seat.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{
                    background: `${p.color}11`,
                    border: `1px solid ${p.color}22`,
                  }}
                >
                  <PlayerAvatar playerId={seat.player_id} size={36} color={p.color} />
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">
                      {seat.player_name}
                      {seat.player_id === playerId && (
                        <span className="text-[#888] text-[10px] ml-2">(you)</span>
                      )}
                    </div>
                    <div className="text-casino-gold text-[11px] font-mono">
                      ${seat.chips.toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Start button (host only) */}
        {isHost && seats.length >= 1 && (
          <GameButton onClick={startRound} color="#FF6B6B" primary>
            Start Game — {seats.length} player{seats.length !== 1 ? "s" : ""}
          </GameButton>
        )}
        {!isHost && (
          <div className="text-center text-[#555] text-xs">Waiting for host to start...</div>
        )}

        {error && (
          <div className="mt-3 text-casino-red text-xs text-center">{error}</div>
        )}
      </div>
    );
  }

  // ─── BETTING ────────────────────────────
  if (phase === "betting" && state) {
    const hasBet = state.bets[playerId];
    const myChips = getSeatChips(playerId);

    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-[22px] font-bold text-white">Place Your Bet</h2>
        </div>

        {/* My betting area */}
        {!hasBet ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-5 mb-4 text-center"
            style={{ background: "#1a1a2e", border: "1px solid #333" }}
          >
            <div className="text-[#888] text-xs mb-3">Your chips: ${myChips.toLocaleString()}</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {[25, 50, 100, 250, 500].map((amt) => (
                <GameButton
                  key={amt}
                  onClick={() => sendAction("bet", { amount: amt })}
                  color="#FFD700"
                  disabled={myChips < amt}
                  primary
                  className="!px-4 !py-2"
                >
                  ${amt}
                </GameButton>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: "#1a1a2e", border: "1px solid #4ADE8044" }}>
            <div className="text-casino-green text-sm font-semibold">Bet placed!</div>
            <ChipStack amount={state.bets[playerId]} />
          </div>
        )}

        {/* Other players' status */}
        <div className="flex flex-col gap-2">
          {state.turnOrder
            .filter((pid) => pid !== playerId)
            .map((pid) => {
              const p = getPlayer(pid);
              const hasBetted = !!state.bets[pid];
              return (
                <div
                  key={pid}
                  className="flex items-center gap-3 rounded-xl p-2.5"
                  style={{ background: "#111118", border: "1px solid #222" }}
                >
                  <PlayerAvatar playerId={pid} size={28} color={p.color} />
                  <span className="text-white text-sm flex-1">{p.name}</span>
                  {hasBetted ? (
                    <span className="text-casino-green text-[11px] font-semibold">Ready</span>
                  ) : (
                    <span className="text-[#555] text-[11px]">Betting...</span>
                  )}
                </div>
              );
            })}
        </div>

        {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}
      </div>
    );
  }

  // ─── PLAYING / RESULTS ────────────────────
  if ((phase === "playing" || phase === "results") && state) {
    const showDealerFull = phase === "results";
    const dVal = state.dealerHand.length > 0 ? handValue(state.dealerHand) : 0;
    const myHand = state.playerHands[playerId];
    const myCards = myHand?.cards || [];

    return (
      <div className="p-6">
        {/* Dealer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-6">
          <div className="text-[#888] text-xs mb-2 uppercase tracking-[2px]">Dealer</div>
          <div className="flex justify-center gap-2 mb-2">
            {state.dealerHand.map((c, i) => (
              <Card key={c.id} card={c} faceDown={!showDealerFull && i === 1} delay={i * 0.15} />
            ))}
          </div>
          {showDealerFull && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono text-lg font-bold"
              style={{ color: dVal > 21 ? "#FF6B6B" : "#fff" }}
            >
              {dVal > 21 ? "BUST" : dVal}
            </motion.div>
          )}
        </motion.div>

        <div className="w-full h-px bg-[#333] my-4" />

        {/* My Hand (prominent) */}
        {myHand && (
          <motion.div
            layout
            className="rounded-2xl p-4 mb-4"
            style={{
              background: isMyTurn ? `${getPlayer(playerId).color}15` : "#111118",
              border: `2px solid ${isMyTurn ? getPlayer(playerId).color : "#222"}`,
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <PlayerAvatar playerId={playerId} size={32} color={getPlayer(playerId).color} active={isMyTurn} />
              <div className="flex-1">
                <div className="text-white text-sm font-semibold">
                  You {isMyTurn && <span className="text-casino-gold text-[10px]">YOUR TURN</span>}
                </div>
                <ChipStack amount={state.bets[playerId]} />
              </div>
              <span
                className="text-xl font-extrabold font-mono"
                style={{
                  color: myHand.status === "bust" ? "#FF6B6B" : handValue(myCards) === 21 ? "#FFD700" : "#fff",
                }}
              >
                {handValue(myCards)}
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {myCards.map((c, i) => (
                <Card key={c.id} card={c} delay={i * 0.1} />
              ))}
            </div>

            {/* Action buttons */}
            <AnimatePresence>
              {isMyTurn && myHand.status === "playing" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 mt-3"
                >
                  <GameButton onClick={() => sendAction("hit")} color="#34D399" primary>
                    Hit
                  </GameButton>
                  <GameButton onClick={() => sendAction("stand")} color="#60A5FA" primary>
                    Stand
                  </GameButton>
                  {myCards.length === 2 && getSeatChips(playerId) >= state.bets[playerId] * 2 && (
                    <GameButton onClick={() => sendAction("double")} color="#F59E0B" primary>
                      Double
                    </GameButton>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result */}
            {state.results?.[playerId] && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm font-bold"
                style={{
                  color: state.results[playerId].amount > 0 ? "#4ADE80" : state.results[playerId].amount < 0 ? "#FF6B6B" : "#888",
                }}
              >
                {state.results[playerId].result}{" "}
                {state.results[playerId].amount > 0
                  ? `+$${state.results[playerId].amount}`
                  : state.results[playerId].amount < 0
                  ? `-$${Math.abs(state.results[playerId].amount)}`
                  : ""}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Other players' hands */}
        <div className="flex flex-col gap-2">
          {state.turnOrder
            .filter((pid) => pid !== playerId)
            .map((pid) => {
              const h = state.playerHands[pid];
              if (!h) return null;
              const p = getPlayer(pid);
              const val = handValue(h.cards);
              const isActive = phase === "playing" && gameState?.currentTurnPlayerId === pid;
              const res = state.results?.[pid];

              return (
                <motion.div
                  key={pid}
                  layout
                  className="rounded-xl p-3"
                  style={{
                    background: isActive ? `${p.color}11` : "#111118",
                    border: `1px solid ${isActive ? p.color : "#222"}`,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar playerId={pid} size={28} color={p.color} active={isActive} />
                    <span className="text-white text-sm font-semibold flex-1">
                      {p.name}
                      {isActive && <span className="text-[#888] text-[10px] ml-2">playing...</span>}
                    </span>
                    <div className="flex gap-1">
                      {h.cards.map((c, i) => (
                        <Card key={c.id} card={c} small delay={i * 0.1} />
                      ))}
                    </div>
                    <span
                      className="text-lg font-extrabold font-mono ml-2"
                      style={{
                        color: h.status === "bust" ? "#FF6B6B" : val === 21 ? "#FFD700" : "#fff",
                      }}
                    >
                      {val}
                    </span>
                  </div>
                  {res && (
                    <div
                      className="mt-1.5 text-xs font-bold text-right"
                      style={{
                        color: res.amount > 0 ? "#4ADE80" : res.amount < 0 ? "#FF6B6B" : "#888",
                      }}
                    >
                      {res.result} {res.amount > 0 ? `+$${res.amount}` : res.amount < 0 ? `-$${Math.abs(res.amount)}` : ""}
                    </div>
                  )}
                </motion.div>
              );
            })}
        </div>

        {/* Results actions */}
        {phase === "results" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 mt-5"
          >
            {isHost && (
              <GameButton onClick={() => sendAction("new-round")} color="#FF6B6B" primary>
                New Round
              </GameButton>
            )}
            <GameButton onClick={goBack} color="#333">
              Leave Table
            </GameButton>
          </motion.div>
        )}

        {error && <div className="mt-3 text-casino-red text-xs text-center">{error}</div>}

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
