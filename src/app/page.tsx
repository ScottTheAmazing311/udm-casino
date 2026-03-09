"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Spade, Dice5, RotateCcw,
  ChevronRight, Crown, Swords,
} from "lucide-react";
import { PLAYERS } from "@/lib/constants";
import { Player, ChipCounts, Screen } from "@/lib/types";
import { AvatarConfig, getRandomAvatar } from "@/lib/avatar";
import AvatarSVG from "@/components/ui/AvatarSVG";
import AvatarCreator from "@/components/AvatarCreator";
import PlayerIcon from "@/components/ui/PlayerIcon";
import BlackjackGame from "@/components/games/BlackjackGame";
import PokerGame from "@/components/games/PokerGame";
import CrapsGame from "@/components/games/CrapsGame";
import GameButton from "@/components/ui/GameButton";

type AppPhase = "select-player" | "create-avatar" | "casino";

export default function Home() {
  const [appPhase, setAppPhase] = useState<AppPhase>("select-player");
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [avatars, setAvatars] = useState<Record<number, AvatarConfig>>({});
  const [screen, setScreen] = useState<Screen>("lobby");
  const [chipCounts, setChipCounts] = useState<ChipCounts>(() => {
    const init: ChipCounts = {};
    PLAYERS.forEach((p) => {
      init[p.id] = 1000;
    });
    return init;
  });

  // Load saved state
  useEffect(() => {
    try {
      const savedChips = localStorage.getItem("udm-casino-chips");
      if (savedChips) setChipCounts(JSON.parse(savedChips));
      const savedAvatars = localStorage.getItem("udm-casino-avatars");
      if (savedAvatars) setAvatars(JSON.parse(savedAvatars));
      const savedPlayer = localStorage.getItem("udm-casino-player");
      if (savedPlayer) {
        const p = JSON.parse(savedPlayer);
        setCurrentPlayer(p);
        setAppPhase("casino");
      }
    } catch {
      // ignore
    }
  }, []);

  // Save on change
  useEffect(() => {
    try {
      localStorage.setItem("udm-casino-chips", JSON.stringify(chipCounts));
    } catch {
      // ignore
    }
  }, [chipCounts]);

  useEffect(() => {
    try {
      localStorage.setItem("udm-casino-avatars", JSON.stringify(avatars));
    } catch {
      // ignore
    }
  }, [avatars]);

  const handleSelectPlayer = (p: Player) => {
    setCurrentPlayer(p);
    if (avatars[p.id]) {
      localStorage.setItem("udm-casino-player", JSON.stringify(p));
      setAppPhase("casino");
    } else {
      setAppPhase("create-avatar");
    }
  };

  const handleAvatarSave = (config: AvatarConfig) => {
    if (!currentPlayer) return;
    const newAvatars = { ...avatars, [currentPlayer.id]: config };
    setAvatars(newAvatars);
    localStorage.setItem("udm-casino-player", JSON.stringify(currentPlayer));
    setAppPhase("casino");
  };

  const resetChips = () => {
    const init: ChipCounts = {};
    PLAYERS.forEach((p) => {
      init[p.id] = 1000;
    });
    setChipCounts(init);
  };

  const switchPlayer = () => {
    localStorage.removeItem("udm-casino-player");
    setCurrentPlayer(null);
    setAppPhase("select-player");
    setScreen("lobby");
  };

  const sorted = [...PLAYERS].sort((a, b) => chipCounts[b.id] - chipCounts[a.id]);

  const getAvatarOrDefault = (p: Player): AvatarConfig => {
    return avatars[p.id] || getRandomAvatar(p.color);
  };

  // ─── SELECT PLAYER ────────────────────────────
  if (appPhase === "select-player") {
    return (
      <div className="min-h-screen bg-casino-dark font-body max-w-[480px] mx-auto felt-texture">
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="text-[11px] tracking-[4px] text-casino-gold uppercase mb-2 font-semibold">
              Private Club
            </div>
            <h1 className="text-4xl font-display text-white tracking-tight mb-2">
              UDM Casino
            </h1>
            <div className="text-[#555] text-xs">Who are you?</div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {PLAYERS.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleSelectPlayer(p)}
                className="flex items-center gap-3 rounded-2xl p-4 cursor-pointer text-left"
                style={{
                  background: `linear-gradient(135deg, ${p.color}11, ${p.color}06)`,
                  border: `1px solid ${p.color}33`,
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {avatars[p.id] ? (
                  <AvatarSVG config={avatars[p.id]} size={40} />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: `${p.color}22`, border: `2px solid ${p.color}44` }}
                  >
                    <PlayerIcon name={p.icon} size={18} color={p.color} />
                  </div>
                )}
                <div>
                  <div className="text-white text-sm font-semibold">{p.name}</div>
                  <div className="text-casino-gold text-[11px] font-mono">
                    ${chipCounts[p.id].toLocaleString()}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── AVATAR CREATOR ────────────────────────────
  if (appPhase === "create-avatar" && currentPlayer) {
    return (
      <div className="min-h-screen bg-casino-dark font-body max-w-[480px] mx-auto felt-texture">
        <AvatarCreator
          player={currentPlayer}
          initialConfig={avatars[currentPlayer.id]}
          onSave={handleAvatarSave}
        />
      </div>
    );
  }

  // ─── GAME SCREENS ────────────────────────────
  return (
    <div className="min-h-screen bg-casino-dark font-body max-w-[480px] mx-auto relative felt-texture">
      <AnimatePresence mode="wait">
        {screen === "blackjack" && (
          <motion.div key="bj" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BlackjackGame
              players={PLAYERS}
              chipCounts={chipCounts}
              setChipCounts={setChipCounts}
              goBack={() => setScreen("lobby")}
            />
          </motion.div>
        )}
        {screen === "poker" && (
          <motion.div key="pk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PokerGame
              players={PLAYERS}
              chipCounts={chipCounts}
              setChipCounts={setChipCounts}
              goBack={() => setScreen("lobby")}
            />
          </motion.div>
        )}
        {screen === "craps" && (
          <motion.div key="cr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CrapsGame
              players={PLAYERS}
              chipCounts={chipCounts}
              setChipCounts={setChipCounts}
              goBack={() => setScreen("lobby")}
            />
          </motion.div>
        )}
        {screen === "leaderboard" && (
          <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Leaderboard
              sorted={sorted}
              chipCounts={chipCounts}
              getAvatarOrDefault={getAvatarOrDefault}
              resetChips={resetChips}
              goBack={() => setScreen("lobby")}
            />
          </motion.div>
        )}
        {screen === "lobby" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Lobby
              currentPlayer={currentPlayer}
              sorted={sorted}
              chipCounts={chipCounts}
              getAvatarOrDefault={getAvatarOrDefault}
              setScreen={setScreen}
              switchPlayer={switchPlayer}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────
function Lobby({
  currentPlayer,
  sorted,
  chipCounts,
  getAvatarOrDefault,
  setScreen,
  switchPlayer,
}: {
  currentPlayer: Player | null;
  sorted: Player[];
  chipCounts: ChipCounts;
  getAvatarOrDefault: (p: Player) => AvatarConfig;
  setScreen: (s: Screen) => void;
  switchPlayer: () => void;
}) {
  return (
    <div className="p-8 pb-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="text-[11px] tracking-[4px] text-casino-gold uppercase mb-1.5 font-semibold">
          Private Club
        </div>
        <h1 className="text-4xl font-display text-white tracking-tight mb-1">
          UDM Casino
        </h1>
        <div className="text-[#555] text-xs">The house always wins. Except when it doesn&apos;t.</div>
      </motion.div>

      {/* Current Player */}
      {currentPlayer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-6 p-3 rounded-xl"
          style={{
            background: `${currentPlayer.color}11`,
            border: `1px solid ${currentPlayer.color}22`,
          }}
        >
          <AvatarSVG config={getAvatarOrDefault(currentPlayer)} size={36} />
          <div className="flex-1">
            <div className="text-white text-sm font-semibold">{currentPlayer.name}</div>
            <div className="text-casino-gold text-[11px] font-mono">
              ${chipCounts[currentPlayer.id].toLocaleString()}
            </div>
          </div>
          <button
            onClick={switchPlayer}
            className="text-[#555] text-[11px] hover:text-white transition-colors"
          >
            Switch
          </button>
        </motion.div>
      )}

      {/* Top 3 */}
      <div className="flex justify-center gap-5 mb-7">
        {sorted.slice(0, 3).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div
              className="text-[10px] font-bold mb-1"
              style={{ color: ["#FFD700", "#C0C0C0", "#CD7F32"][i] }}
            >
              {i === 0 && <Crown size={12} className="inline mr-0.5 mb-0.5" />}
              #{i + 1}
            </div>
            <div
              className="rounded-full p-0.5 mb-1"
              style={{
                background: i === 0 ? "linear-gradient(135deg, #FFD70033, #FFD70011)" : "transparent",
                boxShadow: i === 0 ? "0 0 20px rgba(255,215,0,0.1)" : "none",
              }}
            >
              <AvatarSVG config={getAvatarOrDefault(p)} size={44} />
            </div>
            <div className="text-[11px] text-white font-medium">{p.name}</div>
            <div className="text-casino-gold text-[10px] font-mono font-bold">
              ${chipCounts[p.id].toLocaleString()}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Game Cards */}
      <div className="flex flex-col gap-3 mb-6">
        {[
          {
            id: "blackjack" as Screen,
            name: "Blackjack",
            desc: "Beat the dealer to 21",
            icon: <Swords size={22} />,
            color: "#FF6B6B",
          },
          {
            id: "poker" as Screen,
            name: "Texas Hold'em",
            desc: "No-limit poker, winner takes all",
            icon: <Spade size={22} />,
            color: "#A78BFA",
          },
          {
            id: "craps" as Screen,
            name: "Craps",
            desc: "Roll the dice, test your luck",
            icon: <Dice5 size={22} />,
            color: "#FB923C",
          },
        ].map((game, i) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            onClick={() => setScreen(game.id)}
            className="flex items-center gap-3.5 rounded-2xl p-[18px] cursor-pointer text-left"
            style={{
              background: `linear-gradient(135deg, ${game.color}11, ${game.color}06)`,
              border: `1px solid ${game.color}33`,
            }}
            whileHover={{ scale: 1.01, x: 4 }}
            whileTap={{ scale: 0.99 }}
          >
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center"
              style={{ background: `${game.color}22`, color: game.color }}
            >
              {game.icon}
            </div>
            <div className="flex-1">
              <div className="text-white text-base font-bold">{game.name}</div>
              <div className="text-[#666] text-xs">{game.desc}</div>
            </div>
            <ChevronRight size={18} style={{ color: game.color }} />
          </motion.button>
        ))}
      </div>

      {/* Leaderboard Link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => setScreen("leaderboard")}
        className="w-full flex items-center gap-2.5 rounded-[14px] p-3.5 cursor-pointer"
        style={{ background: "#111118", border: "1px solid #222" }}
        whileHover={{ scale: 1.01 }}
      >
        <Trophy size={18} className="text-casino-gold" />
        <span className="text-white text-sm font-semibold">Leaderboard</span>
        <div className="flex-1" />
        <ChevronRight size={14} className="text-[#555]" />
      </motion.button>
    </div>
  );
}

// ─── LEADERBOARD ────────────────────────────────
function Leaderboard({
  sorted,
  chipCounts,
  getAvatarOrDefault,
  resetChips,
  goBack,
}: {
  sorted: Player[];
  chipCounts: ChipCounts;
  getAvatarOrDefault: (p: Player) => AvatarConfig;
  resetChips: () => void;
  goBack: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <GameButton onClick={goBack} color="#333">
          Back
        </GameButton>
        <h2 className="text-[22px] font-bold text-white m-0">Leaderboard</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {sorted.map((p, i) => {
          const chips = chipCounts[p.id];
          const diff = chips - 1000;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-xl py-2.5 px-3.5"
              style={{
                background: i === 0 ? "linear-gradient(135deg, rgba(255,215,0,0.07), rgba(255,215,0,0.03))" : "#111118",
                border: `1px solid ${i === 0 ? "rgba(255,215,0,0.2)" : "#222"}`,
              }}
            >
              <span
                className="text-base font-extrabold w-6 text-center font-mono"
                style={{
                  color: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] : "#555",
                }}
              >
                {i + 1}
              </span>
              <AvatarSVG config={getAvatarOrDefault(p)} size={32} />
              <div className="flex-1">
                <div className="text-white text-sm font-semibold">{p.name}</div>
              </div>
              <div className="text-right">
                <div className="text-casino-gold text-[15px] font-bold font-mono">
                  ${chips.toLocaleString()}
                </div>
                <div
                  className="text-[11px] font-semibold"
                  style={{
                    color: diff > 0 ? "#4ADE80" : diff < 0 ? "#FF6B6B" : "#555",
                  }}
                >
                  {diff > 0 ? `+$${diff}` : diff < 0 ? `-$${Math.abs(diff)}` : "Even"}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <button
        onClick={resetChips}
        className="flex items-center gap-2 mt-5 text-[11px] text-casino-red font-semibold px-3 py-2 rounded-lg"
        style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)" }}
      >
        <RotateCcw size={12} />
        Reset All Chips to $1,000
      </button>
    </div>
  );
}
