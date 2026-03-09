"use client";

import { motion } from "framer-motion";
import { Coins } from "lucide-react";

export default function ChipStack({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 chip-shimmer"
      style={{
        border: "1px solid rgba(255,215,0,0.2)",
      }}
    >
      <Coins size={14} className="text-casino-gold" />
      <span className="font-mono text-casino-gold text-[13px] font-bold">
        ${amount.toLocaleString()}
      </span>
    </motion.div>
  );
}
