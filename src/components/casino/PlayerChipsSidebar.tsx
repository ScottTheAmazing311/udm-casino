"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, ChevronRight } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";

interface PlayerChipsData {
  id: number;
  name: string;
  chips: number;
  is_online: boolean;
}

export default function PlayerChipsSidebar({ currentPlayerId }: { currentPlayerId: number }) {
  const [players, setPlayers] = useState<PlayerChipsData[]>([]);
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("udm_players")
        .select("id, name, chips, is_online")
        .order("chips", { ascending: false });
      if (data) setPlayers(data);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  const visible = isDesktop || open;

  return (
    <>
      {/* Mobile toggle button */}
      {!isDesktop && (
        <button
          onClick={() => setOpen(!open)}
          className="fixed top-14 right-0 z-50 w-8 h-10 rounded-l-lg flex items-center justify-center"
          style={{
            background: "rgba(17,17,24,0.9)",
            border: "1px solid #2a2a3a",
            borderRight: "none",
          }}
        >
          {open ? (
            <ChevronRight size={14} className="text-casino-gold" />
          ) : (
            <Coins size={12} className="text-casino-gold" />
          )}
        </button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={isDesktop ? false : { x: 200 }}
            animate={{ x: 0 }}
            exit={{ x: 200 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 z-40 h-full flex items-center pointer-events-none"
          >
            <div
              className="pointer-events-auto rounded-l-xl py-3 px-2 max-h-[80vh] overflow-y-auto"
              style={{
                background: "linear-gradient(135deg, rgba(17,17,24,0.95), rgba(13,13,21,0.95))",
                border: "1px solid #2a2a3a",
                borderRight: "none",
                backdropFilter: "blur(8px)",
                boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
                minWidth: 140,
              }}
            >
              <div className="text-[8px] text-white/30 uppercase tracking-[2px] font-bold px-1 mb-2">
                Chip Counts
              </div>

              <div className="flex flex-col gap-1">
                {players.map((p) => {
                  const player = PLAYERS.find((pl) => pl.id === p.id);
                  const isMe = p.id === currentPlayerId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-1.5 py-1 rounded-lg"
                      style={{
                        background: isMe ? "rgba(255,215,0,0.08)" : "transparent",
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-6 h-6 rounded-full overflow-hidden border"
                          style={{
                            borderColor: p.is_online
                              ? (player?.color || "#666")
                              : "#333",
                            opacity: p.is_online ? 1 : 0.4,
                          }}
                        >
                          <Image
                            src={HEADSHOTS[p.id] || ""}
                            alt={p.name}
                            width={24}
                            height={24}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        {p.is_online && (
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#111]"
                            style={{ background: "#34D399" }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[9px] font-medium truncate"
                          style={{ color: isMe ? "#FFD700" : p.is_online ? "#ccc" : "#555" }}
                        >
                          {isMe ? "You" : p.name}
                        </div>
                        <div
                          className="text-[10px] font-mono font-bold"
                          style={{ color: isMe ? "#FFD700" : "#888" }}
                        >
                          ${p.chips.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
