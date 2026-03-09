"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Player, ChipCounts, CardType, PokerWinner } from "@/lib/types";
import { createDeck, evaluatePokerHand } from "@/lib/game-logic";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import GameButton from "@/components/ui/GameButton";
import PlayerSelector from "./PlayerSelector";
import PlayerIcon from "@/components/ui/PlayerIcon";

interface PokerProps {
  players: Player[];
  chipCounts: ChipCounts;
  setChipCounts: (c: ChipCounts) => void;
  goBack: () => void;
}

type Phase = "lobby" | "preflop" | "flop" | "turn" | "river" | "showdown";

export default function PokerGame({ players, chipCounts, setChipCounts, goBack }: PokerProps) {
  const [seated, setSeated] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [deck, setDeck] = useState<CardType[]>([]);
  const [community, setCommunity] = useState<CardType[]>([]);
  const [holeCards, setHoleCards] = useState<Record<number, CardType[]>>({});
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [folded, setFolded] = useState<Record<number, boolean>>({});
  const [turnIdx, setTurnIdx] = useState(0);
  const [roundBets, setRoundBets] = useState<Record<number, number>>({});
  const [winner, setWinner] = useState<PokerWinner | null>(null);
  const [bigBlind] = useState(20);

  const toggleSeat = (p: Player) => {
    if (seated.find((s) => s.id === p.id)) setSeated(seated.filter((s) => s.id !== p.id));
    else if (seated.length < 8) setSeated([...seated, p]);
  };

  const startGame = () => {
    if (seated.length < 2) return;
    const d = createDeck(1);
    let idx = 0;
    const holes: Record<number, CardType[]> = {};
    seated.forEach((p) => {
      holes[p.id] = [d[idx++], d[idx++]];
    });

    const newChips = { ...chipCounts };
    const newBets: Record<number, number> = {};
    const sb = Math.floor(bigBlind / 2);
    newChips[seated[0].id] -= sb;
    newBets[seated[0].id] = sb;
    if (seated.length > 1) {
      newChips[seated[1].id] -= bigBlind;
      newBets[seated[1].id] = bigBlind;
    }

    setDeck(d.slice(idx));
    setHoleCards(holes);
    setCommunity([]);
    setPot(sb + bigBlind);
    setCurrentBet(bigBlind);
    setRoundBets(newBets);
    setFolded({});
    setChipCounts(newChips);
    setTurnIdx(seated.length > 2 ? 2 : 0);
    setPhase("preflop");
    setWinner(null);
  };

  const currentPlayer = seated[turnIdx];

  const advanceToNextPlayer = (newFolded: Record<number, boolean>) => {
    const active = seated.filter((p) => !newFolded[p.id]);
    if (active.length <= 1) {
      const w = active[0];
      const newChips = { ...chipCounts };
      newChips[w.id] += pot;
      setChipCounts(newChips);
      setWinner({ player: w, hand: "Last Standing", amount: pot });
      setPhase("showdown");
      return;
    }

    let next = (turnIdx + 1) % seated.length;
    while (newFolded[seated[next].id]) {
      next = (next + 1) % seated.length;
    }

    const allEven = active.every((p) => (roundBets[p.id] || 0) === currentBet);
    if (allEven && next <= turnIdx) {
      advancePhase(active);
    } else {
      setTurnIdx(next);
    }
  };

  const advancePhase = (active: Player[]) => {
    const d = [...deck];
    const newComm = [...community];

    const nextPhase: Phase =
      phase === "preflop" ? "flop" : phase === "flop" ? "turn" : phase === "turn" ? "river" : "showdown";

    if (nextPhase === "flop") {
      d.shift();
      newComm.push(d.shift()!, d.shift()!, d.shift()!);
    } else if (nextPhase === "turn" || nextPhase === "river") {
      d.shift();
      newComm.push(d.shift()!);
    }

    if (nextPhase === "showdown") {
      let bestPlayer: { player: Player; hand: string } | null = null;
      let bestRank = -1;

      active.forEach((p) => {
        const allCards = [...(holeCards[p.id] || []), ...newComm];
        if (allCards.length >= 5) {
          const eval_ = evaluatePokerHand(allCards);
          if (eval_.rank > bestRank) {
            bestRank = eval_.rank;
            bestPlayer = { player: p, hand: eval_.name };
          }
        }
      });

      if (bestPlayer) {
        const bp = bestPlayer as { player: Player; hand: string };
        const newChips = { ...chipCounts };
        newChips[bp.player.id] += pot;
        setChipCounts(newChips);
        setWinner({ ...bp, amount: pot });
      }
      setCommunity(newComm);
      setDeck(d);
      setPhase("showdown");
      return;
    }

    setCommunity(newComm);
    setDeck(d);
    setCurrentBet(0);
    setRoundBets({});
    let first = 0;
    while (folded[seated[first].id]) first = (first + 1) % seated.length;
    setTurnIdx(first);
    setPhase(nextPhase);
  };

  const fold = () => {
    const newFolded = { ...folded, [currentPlayer.id]: true };
    setFolded(newFolded);
    advanceToNextPlayer(newFolded);
  };

  const call = () => {
    const toCall = currentBet - (roundBets[currentPlayer.id] || 0);
    const actual = Math.min(toCall, chipCounts[currentPlayer.id]);
    const newChips = { ...chipCounts };
    newChips[currentPlayer.id] -= actual;
    setChipCounts(newChips);
    setPot((p) => p + actual);
    setRoundBets({ ...roundBets, [currentPlayer.id]: currentBet });
    advanceToNextPlayer(folded);
  };

  const raise = (amount: number) => {
    const totalBet = currentBet + amount;
    const toCall = totalBet - (roundBets[currentPlayer.id] || 0);
    const actual = Math.min(toCall, chipCounts[currentPlayer.id]);
    const newChips = { ...chipCounts };
    newChips[currentPlayer.id] -= actual;
    setChipCounts(newChips);
    setPot((p) => p + actual);
    setCurrentBet(totalBet);
    setRoundBets({ ...roundBets, [currentPlayer.id]: totalBet });
    advanceToNextPlayer(folded);
  };

  const check = () => {
    setRoundBets({ ...roundBets, [currentPlayer.id]: currentBet });
    advanceToNextPlayer(folded);
  };

  if (phase === "lobby") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <GameButton onClick={goBack} color="#333">
            <ArrowLeft size={16} className="inline mr-1" />
            Back
          </GameButton>
          <h2 className="text-[22px] font-bold text-white m-0">Texas Hold&apos;em</h2>
          <span className="text-[#666] text-[13px]">2-8 players</span>
        </div>
        <div className="mb-6">
          <PlayerSelector players={players} seated={seated} chipCounts={chipCounts} onToggle={toggleSeat} />
        </div>
        <AnimatePresence>
          {seated.length >= 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GameButton onClick={startGame} color="#A78BFA" primary>
                Start — {seated.length} players
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const canCheck = (roundBets[currentPlayer?.id] || 0) >= currentBet;
  const toCall = currentBet - (roundBets[currentPlayer?.id] || 0);

  return (
    <div className="p-6">
      {/* Phase & Pot */}
      <div className="text-center mb-4">
        <div className="text-casino-purple text-[11px] uppercase tracking-[2px]">{phase}</div>
        <div className="text-casino-gold text-2xl font-extrabold font-mono">
          Pot: ${pot.toLocaleString()}
        </div>
      </div>

      {/* Community Cards */}
      <div className="flex justify-center gap-2 mb-5 min-h-[90px]">
        {community.map((c, i) => (
          <Card key={c.id} card={c} delay={i * 0.15} />
        ))}
        {Array.from({ length: 5 - community.length }).map((_, i) => (
          <div
            key={i}
            className="w-16 h-[90px] rounded-[10px] border-2 border-dashed border-[#333] opacity-30"
          />
        ))}
      </div>

      <div className="w-full h-px bg-[#333] my-4" />

      {/* Player Seats */}
      <div className="flex flex-col gap-2.5">
        {seated.map((p, idx) => {
          const isActive = phase !== "showdown" && idx === turnIdx && !folded[p.id];
          const isFolded = folded[p.id];
          const cards = holeCards[p.id] || [];
          const showCards = phase === "showdown" && !isFolded;

          return (
            <motion.div
              key={p.id}
              layout
              className="rounded-[14px] p-3 transition-all duration-300"
              style={{
                background: isActive ? `${p.color}11` : "#111118",
                border: `1px solid ${isActive ? p.color : "#222"}`,
                opacity: isFolded ? 0.4 : 1,
              }}
            >
              <div className="flex items-center gap-2.5">
                <Avatar player={p} size={32} active={isActive} showChips={false} />
                <span className="text-[#888] text-[11px] flex-1 font-mono">
                  ${chipCounts[p.id].toLocaleString()}
                  {roundBets[p.id] ? ` · Bet: $${roundBets[p.id]}` : ""}
                </span>
                <div className="flex gap-1">
                  {cards.map((c, i) => (
                    <Card key={c.id} card={c} faceDown={!showCards} small delay={i * 0.1} />
                  ))}
                </div>
                {isFolded && (
                  <span className="text-casino-red text-[11px] font-semibold">FOLD</span>
                )}
                {showCards && !isFolded && (
                  <span className="text-casino-purple text-[11px] font-semibold">
                    {evaluatePokerHand([...cards, ...community]).name}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 mt-2.5 flex-wrap"
                  >
                    <GameButton onClick={fold} color="#FF6B6B" primary>
                      Fold
                    </GameButton>
                    {canCheck ? (
                      <GameButton onClick={check} color="#60A5FA" primary>
                        Check
                      </GameButton>
                    ) : (
                      <GameButton onClick={call} color="#60A5FA" primary>
                        Call ${toCall}
                      </GameButton>
                    )}
                    <GameButton onClick={() => raise(bigBlind)} color="#34D399" primary>
                      Raise ${bigBlind}
                    </GameButton>
                    <GameButton onClick={() => raise(bigBlind * 3)} color="#F59E0B" primary>
                      Raise ${bigBlind * 3}
                    </GameButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Winner / Showdown */}
      <AnimatePresence>
        {phase === "showdown" && winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-5 text-center p-5 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.13), rgba(255,215,0,0.07))",
              border: "1px solid rgba(255,215,0,0.2)",
            }}
          >
            <div className="flex justify-center mb-2">
              <PlayerIcon name={winner.player.icon} size={28} color={winner.player.color} />
            </div>
            <div className="text-casino-gold text-lg font-bold">{winner.player.name} Wins!</div>
            <div className="text-[#888] text-[13px]">
              {winner.hand} · +${winner.amount.toLocaleString()}
            </div>
            <div className="flex gap-2 justify-center mt-3">
              <GameButton onClick={startGame} color="#A78BFA" primary>
                New Hand
              </GameButton>
              <GameButton onClick={goBack} color="#333">
                Leave Table
              </GameButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
