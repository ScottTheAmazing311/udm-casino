"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Player, ChipCounts, HandState, BlackjackResult, CardType } from "@/lib/types";
import { createDeck, handValue } from "@/lib/game-logic";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import ChipStack from "@/components/ui/ChipStack";
import GameButton from "@/components/ui/GameButton";
import PlayerSelector from "./PlayerSelector";

interface BlackjackProps {
  players: Player[];
  chipCounts: ChipCounts;
  setChipCounts: (c: ChipCounts) => void;
  goBack: () => void;
}

export default function BlackjackGame({
  players,
  chipCounts,
  setChipCounts,
  goBack,
}: BlackjackProps) {
  const [seated, setSeated] = useState<Player[]>([]);
  const [phase, setPhase] = useState<"lobby" | "betting" | "playing" | "results">("lobby");
  const [deck, setDeck] = useState<CardType[]>([]);
  const [dealerHand, setDealerHand] = useState<CardType[]>([]);
  const [playerHands, setPlayerHands] = useState<Record<number, HandState>>({});
  const [bets, setBets] = useState<Record<number, number>>({});
  const [currentTurn, setCurrentTurn] = useState(0);
  const [results, setResults] = useState<Record<number, BlackjackResult>>({});

  const toggleSeat = (p: Player) => {
    if (seated.find((s) => s.id === p.id)) setSeated(seated.filter((s) => s.id !== p.id));
    else if (seated.length < 6) setSeated([...seated, p]);
  };

  const startBetting = () => {
    if (seated.length === 0) return;
    setPhase("betting");
    setBets({});
  };

  const placeBet = (pid: number, amt: number) => {
    const actual = Math.min(amt, chipCounts[pid]);
    if (actual <= 0) return;
    setBets((b) => ({ ...b, [pid]: actual }));
  };

  const dealCards = () => {
    const d = createDeck(4);
    let idx = 0;
    const hands: Record<number, HandState> = {};
    seated.forEach((p) => {
      hands[p.id] = { cards: [d[idx++], d[idx++]], status: "playing" };
    });
    const dHand = [d[idx++], d[idx++]];
    setDeck(d.slice(idx));
    setPlayerHands(hands);
    setDealerHand(dHand);
    setCurrentTurn(0);
    setPhase("playing");
  };

  const currentPlayer = seated[currentTurn];

  const hit = () => {
    if (!currentPlayer) return;
    const pid = currentPlayer.id;
    const h = { ...playerHands[pid] };
    h.cards = [...h.cards, deck[0]];
    setDeck(deck.slice(1));
    const val = handValue(h.cards);
    if (val > 21) h.status = "bust";
    else if (val === 21) h.status = "stand";
    const newHands = { ...playerHands, [pid]: h };
    setPlayerHands(newHands);
    if (h.status !== "playing") advanceTurn(newHands);
  };

  const stand = () => {
    if (!currentPlayer) return;
    const pid = currentPlayer.id;
    const newHands = { ...playerHands, [pid]: { ...playerHands[pid], status: "stand" as const } };
    setPlayerHands(newHands);
    advanceTurn(newHands);
  };

  const doubleDown = () => {
    if (!currentPlayer) return;
    const pid = currentPlayer.id;
    const extraBet = Math.min(bets[pid], chipCounts[pid] - bets[pid]);
    setBets((b) => ({ ...b, [pid]: b[pid] + extraBet }));
    const h = { ...playerHands[pid] };
    h.cards = [...h.cards, deck[0]];
    setDeck(deck.slice(1));
    const val = handValue(h.cards);
    h.status = val > 21 ? "bust" : "stand";
    const newHands = { ...playerHands, [pid]: h };
    setPlayerHands(newHands);
    advanceTurn(newHands);
  };

  const advanceTurn = (hands: Record<number, HandState>) => {
    const next = currentTurn + 1;
    if (next >= seated.length) {
      dealerPlay(hands);
    } else {
      setCurrentTurn(next);
    }
  };

  const dealerPlay = (hands: Record<number, HandState>) => {
    const dCards = [...dealerHand];
    let remaining = [...deck];
    while (handValue(dCards) < 17) {
      dCards.push(remaining[0]);
      remaining = remaining.slice(1);
    }
    setDealerHand(dCards);
    setDeck(remaining);

    const dVal = handValue(dCards);
    const res: Record<number, BlackjackResult> = {};
    const newChips = { ...chipCounts };

    seated.forEach((p) => {
      const h = hands[p.id];
      const pVal = handValue(h.cards);
      const bet = bets[p.id] || 0;

      if (h.status === "bust") {
        res[p.id] = { result: "BUST", amount: -bet };
        newChips[p.id] -= bet;
      } else if (dVal > 21 || pVal > dVal) {
        const isBlackjack = pVal === 21 && h.cards.length === 2;
        const win = isBlackjack ? Math.floor(bet * 1.5) : bet;
        res[p.id] = { result: isBlackjack ? "BLACKJACK!" : "WIN", amount: win };
        newChips[p.id] += win;
      } else if (pVal === dVal) {
        res[p.id] = { result: "PUSH", amount: 0 };
      } else {
        res[p.id] = { result: "LOSE", amount: -bet };
        newChips[p.id] -= bet;
      }
    });

    setChipCounts(newChips);
    setResults(res);
    setPhase("results");
  };

  const newRound = () => {
    setPhase("betting");
    setBets({});
    setPlayerHands({});
    setDealerHand([]);
    setResults({});
    setCurrentTurn(0);
  };

  // LOBBY
  if (phase === "lobby") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <GameButton onClick={goBack} color="#333">
            <ArrowLeft size={16} className="inline mr-1" />
            Back
          </GameButton>
          <h2 className="text-[22px] font-bold text-white m-0">Blackjack</h2>
          <span className="text-[#666] text-[13px]">Select up to 6 players</span>
        </div>
        <div className="mb-6">
          <PlayerSelector
            players={players}
            seated={seated}
            chipCounts={chipCounts}
            onToggle={toggleSeat}
          />
        </div>
        <AnimatePresence>
          {seated.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GameButton onClick={startBetting} color="#FF6B6B" primary>
                Deal — {seated.length} player{seated.length > 1 ? "s" : ""}
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // BETTING
  if (phase === "betting") {
    const allBet = seated.every((p) => bets[p.id]);
    return (
      <div className="p-6">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[22px] font-bold text-white mb-5"
        >
          Place Your Bets
        </motion.h2>
        <div className="flex flex-col gap-3">
          {seated.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{
                background: bets[p.id] ? `${p.color}11` : "#1a1a2e",
                border: `1px solid ${bets[p.id] ? p.color + "44" : "#333"}`,
              }}
            >
              <Avatar player={p} size={36} active={!!bets[p.id]} showChips={false} />
              <span className="text-[#888] text-xs flex-1 font-mono">
                ${chipCounts[p.id].toLocaleString()}
              </span>
              {bets[p.id] ? (
                <ChipStack amount={bets[p.id]} />
              ) : (
                <div className="flex gap-1.5">
                  {[25, 50, 100, 250].map((amt) => (
                    <GameButton
                      key={amt}
                      onClick={() => placeBet(p.id, amt)}
                      color="#333"
                      disabled={chipCounts[p.id] < amt}
                      className="!px-2.5 !py-1.5 !text-[11px]"
                    >
                      ${amt}
                    </GameButton>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {allBet && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <GameButton onClick={dealCards} color="#FF6B6B" primary>
                Deal Cards
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // PLAYING & RESULTS
  const showDealerFull = phase === "results";
  const dVal = handValue(dealerHand);

  return (
    <div className="p-6">
      {/* Dealer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-7"
      >
        <div className="text-[#888] text-xs mb-2 uppercase tracking-[2px]">Dealer</div>
        <div className="flex justify-center gap-2 mb-2">
          {dealerHand.map((c, i) => (
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

      {/* Players */}
      <div className="flex flex-col gap-4">
        {seated.map((p, idx) => {
          const h = playerHands[p.id];
          if (!h) return null;
          const val = handValue(h.cards);
          const isActive = phase === "playing" && idx === currentTurn && h.status === "playing";
          const res = results[p.id];

          return (
            <motion.div
              key={p.id}
              layout
              className="rounded-[14px] p-3.5"
              style={{
                background: isActive ? `${p.color}11` : "#111118",
                border: `1px solid ${isActive ? p.color : "#222"}`,
              }}
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar player={p} size={32} active={isActive} showChips={false} />
                <ChipStack amount={bets[p.id]} />
                <div className="flex-1" />
                <span
                  className="text-xl font-extrabold font-mono"
                  style={{
                    color: h.status === "bust" ? "#FF6B6B" : val === 21 ? "#FFD700" : "#fff",
                  }}
                >
                  {val}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-1">
                {h.cards.map((c, i) => (
                  <Card key={c.id} card={c} small delay={i * 0.1} />
                ))}
              </div>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 mt-2.5"
                  >
                    <GameButton onClick={hit} color="#34D399" primary>
                      Hit
                    </GameButton>
                    <GameButton onClick={stand} color="#60A5FA" primary>
                      Stand
                    </GameButton>
                    {h.cards.length === 2 && chipCounts[p.id] >= bets[p.id] * 2 && (
                      <GameButton onClick={doubleDown} color="#F59E0B" primary>
                        Double
                      </GameButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {res && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm font-bold"
                  style={{
                    color: res.amount > 0 ? "#4ADE80" : res.amount < 0 ? "#FF6B6B" : "#888",
                  }}
                >
                  {res.result}{" "}
                  {res.amount > 0 ? `+$${res.amount}` : res.amount < 0 ? `-$${Math.abs(res.amount)}` : ""}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {phase === "results" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mt-5"
        >
          <GameButton onClick={newRound} color="#FF6B6B" primary>
            New Round
          </GameButton>
          <GameButton onClick={goBack} color="#333">
            Leave Table
          </GameButton>
        </motion.div>
      )}
    </div>
  );
}
