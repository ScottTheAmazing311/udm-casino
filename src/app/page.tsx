"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowLeft, KeyRound } from "lucide-react";
import { PLAYERS } from "@/lib/constants";
import { Player } from "@/lib/types";
import { CasinoTable } from "@/lib/store/casino-store";
import { useCasinoStore } from "@/lib/store/casino-store";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import GameButton from "@/components/ui/GameButton";
import IsometricFloor from "@/components/casino/IsometricFloor";
import GameTableView from "@/components/casino/GameTableView";

type AppPhase =
  | "select-player"
  | "enter-passcode"
  | "change-passcode"
  | "casino-floor"
  | "at-table";

interface Session {
  playerId: number;
  playerName: string;
  token: string;
  hasChangedPasscode: boolean;
}

export default function Home() {
  const [appPhase, setAppPhase] = useState<AppPhase>("select-player");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeTable, setActiveTable] = useState<CasinoTable | null>(null);
  const [passcode, setPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [loginError, setLoginError] = useState("");

  const { setSession: setStoreSession, clearSession } = useCasinoStore();

  // Check for saved session
  useEffect(() => {
    try {
      const saved = localStorage.getItem("udm-casino-session");
      if (saved) {
        const s = JSON.parse(saved) as Session;
        setSession(s);
        setStoreSession(s.playerId, s.playerName);
        setAppPhase("casino-floor");
      }
    } catch {
      // ignore
    }
  }, [setStoreSession]);

  const handleSelectPlayer = (p: Player) => {
    setSelectedPlayer(p);
    setPasscode("");
    setLoginError("");
    setAppPhase("enter-passcode");
  };

  const handleLogin = async () => {
    if (!selectedPlayer) return;
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: selectedPlayer.id, passcode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }

      const s: Session = {
        playerId: data.player.id,
        playerName: data.player.name,
        token: data.token,
        hasChangedPasscode: data.player.has_changed_passcode,
      };

      setSession(s);
      setStoreSession(s.playerId, s.playerName);
      localStorage.setItem("udm-casino-session", JSON.stringify(s));

      if (!data.player.has_changed_passcode) {
        setNewPasscode("");
        setAppPhase("change-passcode");
      } else {
        setAppPhase("casino-floor");
      }
    } catch {
      setLoginError("Network error");
    }
  };

  const handleChangePasscode = async () => {
    if (!session || !newPasscode) return;

    try {
      const res = await fetch("/api/auth/change-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          currentPasscode: passcode,
          newPasscode,
        }),
      });

      if (!res.ok) {
        setLoginError("Failed to change passcode");
        return;
      }

      const updatedSession = { ...session, hasChangedPasscode: true };
      setSession(updatedSession);
      localStorage.setItem("udm-casino-session", JSON.stringify(updatedSession));
      setAppPhase("casino-floor");
    } catch {
      setLoginError("Network error");
    }
  };

  const handleSitDown = (tableId: string) => {
    const { casinoTables } = useCasinoStore.getState();
    const table = casinoTables.find((t) => t.id === tableId);
    if (table) {
      setActiveTable(table);
      setAppPhase("at-table");
    }
  };

  const logout = () => {
    localStorage.removeItem("udm-casino-session");
    setSession(null);
    setSelectedPlayer(null);
    setPasscode("");
    clearSession();
    setAppPhase("select-player");
  };

  // ─── SELECT PLAYER ────────────────────────
  if (appPhase === "select-player") {
    return (
      <Shell>
        <div className="p-8">
          <Header subtitle="Who are you?" />
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
                <PlayerAvatar playerId={p.id} size={40} color={p.color} />
                <div>
                  <div className="text-white text-sm font-semibold">{p.name}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // ─── ENTER PASSCODE ────────────────────────
  if (appPhase === "enter-passcode" && selectedPlayer) {
    return (
      <Shell>
        <div className="p-8">
          <button
            onClick={() => setAppPhase("select-player")}
            className="text-[#555] text-xs mb-6 flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div className="text-center mb-8">
            <div className="mx-auto mb-3 w-fit">
              <PlayerAvatar playerId={selectedPlayer.id} size={64} color={selectedPlayer.color} />
            </div>
            <h2 className="text-xl font-bold text-white">{selectedPlayer.name}</h2>
            <div className="text-[#555] text-xs mt-1">Enter your passcode</div>
          </div>

          <div className="max-w-[240px] mx-auto">
            <div className="relative mb-4">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Passcode"
                className="w-full bg-casino-subtle rounded-xl px-4 py-3 pl-9 text-white text-sm outline-none border border-[#333] focus:border-casino-gold transition-colors"
                autoFocus
              />
            </div>
            <GameButton onClick={handleLogin} color={selectedPlayer.color} primary className="w-full">
              Login
            </GameButton>
            {loginError && (
              <div className="text-casino-red text-xs text-center mt-3">{loginError}</div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ─── CHANGE PASSCODE ────────────────────────
  if (appPhase === "change-passcode" && session) {
    return (
      <Shell>
        <div className="p-8">
          <div className="text-center mb-8">
            <KeyRound size={32} className="text-casino-gold mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">Set Your Passcode</h2>
            <div className="text-[#555] text-xs mt-1">Choose a personal code so only you can log in</div>
          </div>
          <div className="max-w-[240px] mx-auto">
            <input
              type="password"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangePasscode()}
              placeholder="New passcode"
              className="w-full bg-casino-subtle rounded-xl px-4 py-3 text-white text-sm outline-none border border-[#333] focus:border-casino-gold transition-colors mb-4"
              autoFocus
            />
            <GameButton
              onClick={handleChangePasscode}
              color="#FFD700"
              primary
              className="w-full"
              disabled={!newPasscode}
            >
              Set Passcode
            </GameButton>
            {loginError && (
              <div className="text-casino-red text-xs text-center mt-3">{loginError}</div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ─── AT TABLE ────────────────────────
  if (appPhase === "at-table" && activeTable && session) {
    return (
      <Shell>
        <GameTableView
          table={activeTable}
          playerId={session.playerId}
          onLeave={() => {
            setActiveTable(null);
            setAppPhase("casino-floor");
          }}
        />
      </Shell>
    );
  }

  // ─── CASINO FLOOR ────────────────────────
  if (appPhase === "casino-floor" && session) {
    return (
      <IsometricFloor
        playerId={session.playerId}
        playerName={session.playerName}
        onSitDown={handleSitDown}
        onLogout={logout}
      />
    );
  }

  return (
    <Shell>
      <div className="p-8 text-center text-[#555]">Loading...</div>
    </Shell>
  );
}

// ─── SHARED COMPONENTS ────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-casino-dark font-body max-w-[480px] mx-auto relative felt-texture">
      {children}
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
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
      <div className="text-[#555] text-xs">{subtitle}</div>
    </motion.div>
  );
}
