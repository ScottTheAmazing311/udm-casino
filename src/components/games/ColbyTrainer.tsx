"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { GraduationCap, X, Lightbulb, TrendingUp } from "lucide-react";
import { CardType } from "@/lib/types";
import { getOptimalPlay, getColbyTip, StrategyAdvice } from "@/lib/blackjack-strategy";
import { handValue } from "@/lib/game-logic";

interface ColbyTrainerProps {
  playerCards: CardType[];
  dealerUpcard: CardType | null;
  isActive: boolean;
  visible: boolean;
  onToggle: () => void;
}

export default function ColbyTrainer({
  playerCards,
  dealerUpcard,
  isActive,
  visible,
  onToggle,
}: ColbyTrainerProps) {
  const [advice, setAdvice] = useState<StrategyAdvice | null>(null);
  const [tip, setTip] = useState("");
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (isActive && dealerUpcard && playerCards.length >= 2) {
      const a = getOptimalPlay(playerCards, dealerUpcard);
      setAdvice(a);
      const val = handValue(playerCards);
      setTip(getColbyTip(a, val));
      setShowTip(true);
    } else {
      setShowTip(false);
    }
  }, [playerCards, dealerUpcard, isActive]);

  return (
    <>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: visible
            ? "linear-gradient(135deg, #34D399, #059669)"
            : "linear-gradient(135deg, #1e1e2e, #111118)",
          border: `2px solid ${visible ? "#34D399" : "#333"}`,
          boxShadow: visible
            ? "0 0 20px rgba(52,211,153,0.3)"
            : "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <GraduationCap size={20} color={visible ? "#fff" : "#888"} />
      </motion.button>

      {/* Trainer Panel */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-20 left-4 right-4 z-40 max-w-[460px] mx-auto"
          >
            <div
              className="rounded-2xl p-4 backdrop-blur-sm"
              style={{
                background: "linear-gradient(135deg, rgba(17,17,24,0.95), rgba(26,26,46,0.95))",
                border: "1px solid rgba(52,211,153,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    border: "2px solid #34D399",
                    boxShadow: "0 0 12px rgba(52,211,153,0.2)",
                  }}
                >
                  <Image
                    src="/colby.png"
                    alt="Colby Massa"
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">Colby Massa</div>
                  <div className="text-[#34D399] text-[10px] font-semibold uppercase tracking-wider">
                    Blackjack Trainer
                  </div>
                </div>
                <button onClick={onToggle} className="text-[#555] hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Advice */}
              <AnimatePresence mode="wait">
                {showTip && advice ? (
                  <motion.div
                    key={tip}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Recommended Action */}
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-casino-gold" />
                      <span className="text-casino-gold text-xs font-semibold uppercase tracking-wider">
                        Recommended
                      </span>
                    </div>
                    <div
                      className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between"
                      style={{
                        background: advice.action === "H" ? "rgba(96,165,250,0.15)"
                          : advice.action === "S" ? "rgba(167,139,250,0.15)"
                          : advice.action === "D" ? "rgba(245,158,11,0.15)"
                          : "rgba(52,211,153,0.15)",
                        border: `1px solid ${
                          advice.action === "H" ? "rgba(96,165,250,0.3)"
                          : advice.action === "S" ? "rgba(167,139,250,0.3)"
                          : advice.action === "D" ? "rgba(245,158,11,0.3)"
                          : "rgba(52,211,153,0.3)"
                        }`,
                      }}
                    >
                      <span className="text-white text-lg font-bold">{advice.actionName}</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} className="text-[#888]" />
                        <span className="text-[#888] text-[11px]">{advice.confidence}</span>
                      </div>
                    </div>

                    {/* Colby's tip */}
                    <p className="text-[#aaa] text-[13px] leading-relaxed m-0">
                      &ldquo;{tip}&rdquo;
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[#555] text-xs text-center py-4"
                  >
                    {isActive
                      ? "Analyzing your hand..."
                      : "Waiting for your turn. I'll give you advice when it's time to act."}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
