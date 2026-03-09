"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight, Swords, Lock,
  Plus, LogIn, Users, ArrowLeft, KeyRound,
} from "lucide-react";
import { PLAYERS } from "@/lib/constants";
import { Player, GameTable, Seat } from "@/lib/types";
import { AvatarConfig, getRandomAvatar } from "@/lib/avatar";
import AvatarSVG from "@/components/ui/AvatarSVG";
import AvatarCreator from "@/components/AvatarCreator";
import PlayerIcon from "@/components/ui/PlayerIcon";
import GameButton from "@/components/ui/GameButton";
import MultiplayerBlackjack from "@/components/games/MultiplayerBlackjack";

type AppPhase =
  | "select-player"
  | "enter-passcode"
  | "change-passcode"
  | "create-avatar"
  | "casino-lobby"
  | "at-table";

interface Session {
  playerId: number;
  playerName: string;
  token: string;
  hasChangedPasscode: boolean;
  avatarConfig: AvatarConfig | null;
}

interface ActiveTable {
  tableId: string;
  joinCode: string;
  isHost: boolean;
}

export default function Home() {
  const [appPhase, setAppPhase] = useState<AppPhase>("select-player");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [avatars, setAvatars] = useState<Record<number, AvatarConfig>>({});
  const [activeTable, setActiveTable] = useState<ActiveTable | null>(null);
  const [passcode, setPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tables, setTables] = useState<(GameTable & { udm_seats: Seat[] })[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Check for saved session
  useEffect(() => {
    try {
      const saved = localStorage.getItem("udm-casino-session");
      if (saved) {
        const s = JSON.parse(saved) as Session;
        setSession(s);
        if (s.avatarConfig) {
          setAvatars((prev) => ({ ...prev, [s.playerId]: s.avatarConfig! }));
        }
        setAppPhase("casino-lobby");
      }
      const savedAvatars = localStorage.getItem("udm-casino-avatars");
      if (savedAvatars) {
        setAvatars(JSON.parse(savedAvatars));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save avatars
  useEffect(() => {
    try {
      localStorage.setItem("udm-casino-avatars", JSON.stringify(avatars));
    } catch {
      // ignore
    }
  }, [avatars]);

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await fetch("/api/game/tables");
      const data = await res.json();
      setTables(data.tables || []);
    } catch {
      // ignore
    }
    setLoadingTables(false);
  }, []);

  // Load tables when in lobby
  useEffect(() => {
    if (appPhase === "casino-lobby") {
      fetchTables();
      const interval = setInterval(fetchTables, 5000);
      return () => clearInterval(interval);
    }
  }, [appPhase, fetchTables]);

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
        avatarConfig: data.player.avatar_config,
      };

      setSession(s);
      localStorage.setItem("udm-casino-session", JSON.stringify(s));

      if (data.player.avatar_config) {
        setAvatars((prev) => ({ ...prev, [data.player.id]: data.player.avatar_config }));
      }

      // First time? Force passcode change, then avatar
      if (!data.player.has_changed_passcode) {
        setNewPasscode("");
        setAppPhase("change-passcode");
      } else if (!data.player.avatar_config) {
        setAppPhase("create-avatar");
      } else {
        setAppPhase("casino-lobby");
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

      // Now go to avatar creation if needed
      if (!session.avatarConfig) {
        setAppPhase("create-avatar");
      } else {
        setAppPhase("casino-lobby");
      }
    } catch {
      setLoginError("Network error");
    }
  };

  const handleAvatarSave = async (config: AvatarConfig) => {
    if (!session) return;

    setAvatars((prev) => ({ ...prev, [session.playerId]: config }));

    // Save to server
    await fetch("/api/auth/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: session.playerId, avatarConfig: config }),
    });

    const updatedSession = { ...session, avatarConfig: config };
    setSession(updatedSession);
    localStorage.setItem("udm-casino-session", JSON.stringify(updatedSession));
    setAppPhase("casino-lobby");
  };

  const createTable = async () => {
    if (!session) return;

    try {
      const res = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          playerName: session.playerName,
          gameType: "blackjack",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setActiveTable({
          tableId: data.table.id,
          joinCode: data.joinCode,
          isHost: true,
        });
        setAppPhase("at-table");
      }
    } catch {
      // ignore
    }
  };

  const handleJoinTable = async (code?: string) => {
    if (!session) return;
    const codeToUse = code || joinCode;
    if (!codeToUse) return;

    try {
      const res = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: codeToUse,
          playerId: session.playerId,
          playerName: session.playerName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setActiveTable({
          tableId: data.table.id,
          joinCode: data.table.join_code,
          isHost: data.table.host_player_id === session.playerId,
        });
        setAppPhase("at-table");
      } else {
        setLoginError(data.error || "Failed to join");
      }
    } catch {
      setLoginError("Network error");
    }
  };

  const logout = () => {
    localStorage.removeItem("udm-casino-session");
    setSession(null);
    setSelectedPlayer(null);
    setPasscode("");
    setAppPhase("select-player");
  };

  const getAvatar = (pid: number): AvatarConfig => {
    return avatars[pid] || getRandomAvatar(PLAYERS.find((p) => p.id === pid)?.color || "#666");
  };

  const currentPlayer = session
    ? PLAYERS.find((p) => p.id === session.playerId) || PLAYERS[0]
    : null;

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
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: `${p.color}22`, border: `2px solid ${p.color}44` }}
                >
                  <PlayerIcon name={p.icon} size={18} color={p.color} />
                </div>
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
          <button onClick={() => setAppPhase("select-player")} className="text-[#555] text-xs mb-6 flex items-center gap-1">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: `${selectedPlayer.color}22`, border: `2px solid ${selectedPlayer.color}44` }}
            >
              <PlayerIcon name={selectedPlayer.icon} size={28} color={selectedPlayer.color} />
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

  // ─── CREATE AVATAR ────────────────────────
  if (appPhase === "create-avatar" && currentPlayer) {
    return (
      <Shell>
        <AvatarCreator
          player={currentPlayer}
          initialConfig={avatars[currentPlayer.id]}
          onSave={handleAvatarSave}
        />
      </Shell>
    );
  }

  // ─── AT TABLE ────────────────────────
  if (appPhase === "at-table" && activeTable && session) {
    return (
      <Shell>
        <MultiplayerBlackjack
          tableId={activeTable.tableId}
          joinCode={activeTable.joinCode}
          playerId={session.playerId}
          isHost={activeTable.isHost}
          avatars={avatars}
          goBack={() => {
            setActiveTable(null);
            setAppPhase("casino-lobby");
          }}
        />
      </Shell>
    );
  }

  // ─── CASINO LOBBY ────────────────────────
  if (appPhase === "casino-lobby" && session && currentPlayer) {
    return (
      <Shell>
        <div className="p-8 pb-6">
          <Header subtitle="The house always wins. Except when it doesn't." />

          {/* Current Player Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 mb-6 p-3 rounded-xl"
            style={{
              background: `${currentPlayer.color}11`,
              border: `1px solid ${currentPlayer.color}22`,
            }}
          >
            <AvatarSVG config={getAvatar(session.playerId)} size={36} />
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">{session.playerName}</div>
            </div>
            <button onClick={logout} className="text-[#555] text-[11px] hover:text-white transition-colors">
              Logout
            </button>
          </motion.div>

          {/* Create / Join */}
          <div className="flex gap-3 mb-6">
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={createTable}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl p-4 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #FF6B6B11, #FF6B6B06)",
                border: "1px solid #FF6B6B33",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={18} className="text-casino-red" />
              <span className="text-white text-sm font-semibold">Create Table</span>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1"
            >
              <div className="flex rounded-2xl overflow-hidden" style={{ border: "1px solid #A78BFA33" }}>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinTable()}
                  placeholder="Code"
                  className="flex-1 bg-transparent px-3 py-4 text-white text-sm font-mono outline-none placeholder:text-[#555] tracking-wider"
                  maxLength={6}
                />
                <button
                  onClick={() => handleJoinTable()}
                  className="px-4 flex items-center"
                  style={{ background: "rgba(167,139,250,0.15)" }}
                >
                  <LogIn size={16} className="text-casino-purple" />
                </button>
              </div>
            </motion.div>
          </div>

          {loginError && (
            <div className="text-casino-red text-xs text-center mb-4">{loginError}</div>
          )}

          {/* Active Tables */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[#888]" />
              <span className="text-[#888] text-xs">
                {loadingTables ? "Loading..." : `${tables.length} active table${tables.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {tables.length === 0 && !loadingTables && (
              <div className="text-center py-8 text-[#444] text-xs">
                No active tables. Create one to get started.
              </div>
            )}

            <div className="flex flex-col gap-2">
              {tables.map((table, i) => {
                const hostPlayer = PLAYERS.find((p) => p.id === table.host_player_id);
                const seatCount = table.udm_seats?.length || 0;
                const iAmSeated = table.udm_seats?.some((s) => s.player_id === session.playerId);

                return (
                  <motion.button
                    key={table.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleJoinTable(table.join_code)}
                    className="flex items-center gap-3 rounded-xl p-3 cursor-pointer text-left w-full"
                    style={{
                      background: iAmSeated ? "rgba(255,215,0,0.05)" : "#111118",
                      border: `1px solid ${iAmSeated ? "rgba(255,215,0,0.15)" : "#222"}`,
                    }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FF6B6B22" }}>
                      <Swords size={18} className="text-casino-red" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-semibold">
                        {hostPlayer?.name}&apos;s Table
                        {iAmSeated && <span className="text-casino-gold text-[10px] ml-2">JOINED</span>}
                      </div>
                      <div className="text-[#666] text-[11px]">
                        {seatCount}/6 players · {table.status === "active" ? "In progress" : "Waiting"}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {table.udm_seats?.slice(0, 4).map((seat) => (
                        <div key={seat.id} className="w-6 h-6 rounded-full overflow-hidden border border-casino-dark">
                          <AvatarSVG config={getAvatar(seat.player_id)} size={24} />
                        </div>
                      ))}
                    </div>
                    <ChevronRight size={14} className="text-[#555]" />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return <Shell><div className="p-8 text-center text-[#555]">Loading...</div></Shell>;
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
