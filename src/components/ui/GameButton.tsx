"use client";

import { motion } from "framer-motion";

interface GameButtonProps {
  onClick: () => void;
  color: string;
  primary?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function GameButton({
  onClick,
  color,
  primary = false,
  children,
  disabled = false,
  className = "",
}: GameButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[10px] px-5 py-2.5 text-[13px] font-semibold font-body cursor-pointer ${className}`}
      style={{
        background: primary ? color : "transparent",
        color: primary ? "#fff" : color === "#333" ? "#aaa" : color,
        border: primary ? "none" : `1px solid ${color}`,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}
