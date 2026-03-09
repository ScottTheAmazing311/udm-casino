"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Player, ChipCounts, CrapsBet, CrapsResult } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Dice from "@/components/ui/Dice";
import GameButton from "@/components/ui/GameButton";
import PlayerSelector from "./PlayerSelector";

interface CrapsProps {
  players: Player[];
  chipCounts: ChipCounts;
  setChipCounts: (c: ChipCounts) => void;
  goBack: () => void;
}

export default function CrapsGame({ players, chipCounts, setChipCounts, goBack }: CrapsProps) {
  const [seated, setSeated] = useState<Player[]>([]);
  const [phase, setPhase] = useState<"lobby" | "betting" | "rolling" | "point" | "results">("lobby");
  const [dice, setDice] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [point, setPoint] = useState<number | null>(null);
  const [bets, setBets] = useState<Record<number, CrapsBet>>({});
  const [shooterIdx, setShooterIdx] = useState(0);
  const [results, setResults] = useState<Record<number, CrapsResult>>({});
  const [history, setHistory] = useState<number[]>([]);

  const toggleSeat = (p: Player) => {
    if (seated.find((s) => s.id === p.id)) setSeated(seated.filter((s) => s.id !== p.id));
    else setSeated([...seated, p]);
  };

  const startGame = () => {
    if (seated.length === 0) return;
    setPhase("betting");
    setBets({});
    setPoint(null);
    setResults({});
  };

  const placeBet = (pid: number, type: CrapsBet["type"], amount: number) => {
    const actual = Math.min(amount, chipCounts[pid]);
    if (actual <= 0) return;
    setBets((b) => ({ ...b, [pid]: { type, amount: actual } }));
  };

  const allBet = seated.every((p) => bets[p.id]);
  const shooter = seated[shooterIdx % seated.length];

  const rollDice = () => {
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
      count++;
      if (count > 8) {
        clearInterval(interval);
        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        setDice([d1, d2]);
        setRolling(false);
        resolveRoll(d1 + d2);
      }
    }, 100);
  };

  const resolveRoll = (total: number) => {
    setHistory((h) => [...h, total]);

    if (point === null) {
      if ([7, 11].includes(total)) {
        resolveResults("pass-win", total);
      } else if ([2, 3, 12].includes(total)) {
        resolveResults("pass-lose", total);
      } else {
        setPoint(total);
        setPhase("point");
      }
    } else {
      if (total === point) {
        resolveResults("pass-win", total);
      } else if (total === 7) {
        resolveResults("pass-lose", total);
      }
    }
  };

  const resolveResults = (outcome: string, total: number) => {
    const res: Record<number, CrapsResult> = {};
    const newChips = { ...chipCounts };

    seated.forEach((p) => {
      const bet = bets[p.id];
      if (!bet) return;

      let won = false;
      if (bet.type === "pass") {
        won = outcome === "pass-win";
      } else if (bet.type === "dontpass") {
        won = outcome === "pass-lose" && total !== 12;
        if (total === 12 && outcome === "pass-lose") {
          res[p.id] = { result: "PUSH", amount: 0 };
          return;
        }
      } else if (bet.type === "field") {
        won = [2, 3, 4, 9, 10, 11, 12].includes(total);
        if ([2, 12].includes(total)) {
          res[p.id] = { result: "WIN 2x", amount: bet.amount * 2 };
          newChips[p.id] += bet.amount * 2;
          return;
        }
      }

      if (won) {
        res[p.id] = { result: "WIN", amount: bet.amount };
        newChips[p.id] += bet.amount;
      } else {
        res[p.id] = { result: "LOSE", amount: -bet.amount };
        newChips[p.id] -= bet.amount;
      }
    });

    setChipCounts(newChips);
    setResults(res);
    setPhase("results");
  };

  const newRound = () => {
    setShooterIdx((i) => (i + 1) % seated.length);
    setPhase("betting");
    setBets({});
    setPoint(null);
    setResults({});
  };

  if (phase === "lobby") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <GameButton onClick={goBack} color="#333">
            <ArrowLeft size={16} className="inline mr-1" />
            Back
          </GameButton>
          <h2 className="text-[22px] font-bold text-white m-0">Craps</h2>
        </div>
        <div className="mb-6">
          <PlayerSelector players={players} seated={seated} chipCounts={chipCounts} onToggle={toggleSeat} />
        </div>
        <AnimatePresence>
          {seated.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GameButton onClick={startGame} color="#FB923C" primary>
                Start — {seated.length} player{seated.length > 1 ? "s" : ""}
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // BETTING
  if (phase === "betting") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1.5">
          <h2 className="text-[22px] font-bold text-white m-0">Craps — Place Bets</h2>
        </div>
        {shooter && (
          <div className="text-[#888] text-xs mb-4">
            Shooter: <span style={{ color: shooter.color }}>{shooter.name}</span>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {seated.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl p-3"
              style={{
                background: bets[p.id] ? `${p.color}11` : "#1a1a2e",
                border: `1px solid ${bets[p.id] ? p.color + "44" : "#333"}`,
              }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar player={p} size={32} showChips={false} />
                <span className="text-[#888] text-[11px] flex-1 font-mono">
                  ${chipCounts[p.id].toLocaleString()}
                </span>
                {bets[p.id] && (
                  <span className="text-casino-gold text-xs font-semibold">
                    {bets[p.id].type.toUpperCase()} — ${bets[p.id].amount}
                  </span>
                )}
              </div>
              {!bets[p.id] && (
                <div className="flex gap-1.5 flex-wrap">
                  {(["pass", "dontpass", "field"] as const).map((type) =>
                    [25, 50, 100].map((amt) => (
                      <GameButton
                        key={`${type}-${amt}`}
                        onClick={() => placeBet(p.id, type, amt)}
                        color="#333"
                        disabled={chipCounts[p.id] < amt}
                        className="!px-2 !py-1 !text-[10px]"
                      >
                        {type === "pass" ? "Pass" : type === "dontpass" ? "Don't" : "Field"} ${amt}
                      </GameButton>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {allBet && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <GameButton onClick={rollDice} color="#FB923C" primary>
                Roll!
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ROLLING / POINT / RESULTS
  return (
    <div className="p-6">
      <div className="text-center mb-5">
        {point && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-3"
            style={{
              background: "rgba(251,146,60,0.13)",
              border: "1px solid rgba(251,146,60,0.27)",
            }}
          >
            <span className="text-casino-orange text-xs font-semibold">POINT: {point}</span>
          </motion.div>
        )}
        <div className="flex justify-center gap-4 mb-3">
          <Dice value={dice[0]} rolling={rolling} />
          <Dice value={dice[1]} rolling={rolling} />
        </div>
        <motion.div
          key={dice[0] + dice[1]}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-white text-[32px] font-extrabold font-mono"
        >
          {dice[0] + dice[1]}
        </motion.div>
        {shooter && (
          <div className="text-[#888] text-[11px] mt-1">Shooter: {shooter.name}</div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex gap-1.5 justify-center mb-4 flex-wrap">
          {history.slice(-10).map((h, i) => (
            <span
              key={i}
              className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: h === 7 ? "rgba(255,107,107,0.13)" : "#333",
                color: h === 7 ? "#FF6B6B" : "#888",
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* Players & Results */}
      <div className="flex flex-col gap-2">
        {seated.map((p) => {
          const bet = bets[p.id];
          const res = results[p.id];
          return (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl p-2.5"
              style={{ background: "#111118", border: "1px solid #222" }}
            >
              <Avatar player={p} size={28} showChips={false} />
              <span className="text-[#888] text-[11px] flex-1">
                {bet?.type.toUpperCase()} ${bet?.amount}
              </span>
              {res && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-[13px] font-bold"
                  style={{
                    color: res.amount > 0 ? "#4ADE80" : res.amount < 0 ? "#FF6B6B" : "#888",
                  }}
                >
                  {res.result}{" "}
                  {res.amount > 0 ? `+$${res.amount}` : res.amount < 0 ? `-$${Math.abs(res.amount)}` : ""}
                </motion.span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center mt-5">
        {phase === "point" && !rolling && (
          <GameButton onClick={rollDice} color="#FB923C" primary>
            Roll Again
          </GameButton>
        )}
        {phase === "results" && (
          <>
            <GameButton onClick={newRound} color="#FB923C" primary>
              New Round
            </GameButton>
            <GameButton onClick={goBack} color="#333">
              Leave Table
            </GameButton>
          </>
        )}
      </div>
    </div>
  );
}
