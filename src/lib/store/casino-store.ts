import { create } from "zustand";

export interface CasinoTable {
  id: string;
  game_type: "blackjack" | "poker" | "craps" | "roulette" | "slots";
  table_name: string;
  floor_x: number;
  floor_y: number;
  max_seats: number;
  min_bet: number;
  max_bet: number;
}

export interface CasinoSeat {
  id: string;
  table_id: string;
  player_id: number;
  seat_number: number;
}

export interface PlayerStats {
  id: number;
  name: string;
  chips: number;
  chips_all_time_high: number;
  chips_all_time_low: number;
  total_hands_played: number;
  total_wins: number;
  total_losses: number;
  is_online: boolean;
}

interface CasinoState {
  // Current session
  playerId: number | null;
  playerName: string | null;

  // Floor data
  casinoTables: CasinoTable[];
  casinoSeats: CasinoSeat[];
  onlinePlayers: number[];
  playerStats: PlayerStats[];

  // UI state
  selectedTableId: string | null;
  showLeaderboard: boolean;
  showChat: boolean;

  // Music
  musicTrack: string | null;
  musicPlaying: boolean;
  musicMuted: boolean;
  _audio: HTMLAudioElement | null;

  // Actions
  setSession: (playerId: number, playerName: string) => void;
  clearSession: () => void;
  setCasinoTables: (tables: CasinoTable[]) => void;
  setCasinoSeats: (seats: CasinoSeat[]) => void;
  setOnlinePlayers: (ids: number[]) => void;
  setPlayerStats: (stats: PlayerStats[]) => void;
  selectTable: (tableId: string | null) => void;
  toggleLeaderboard: () => void;
  toggleChat: () => void;
  playMusic: (track: string) => void;
  toggleMusicMute: () => void;
  stopMusic: () => void;
}

export const useCasinoStore = create<CasinoState>((set, get) => ({
  playerId: null,
  playerName: null,
  casinoTables: [],
  casinoSeats: [],
  onlinePlayers: [],
  playerStats: [],
  selectedTableId: null,
  showLeaderboard: false,
  showChat: false,
  musicTrack: null,
  musicPlaying: false,
  musicMuted: false,
  _audio: null,

  setSession: (playerId, playerName) => set({ playerId, playerName }),
  clearSession: () => set({ playerId: null, playerName: null }),
  setCasinoTables: (casinoTables) => set({ casinoTables }),
  setCasinoSeats: (casinoSeats) => set({ casinoSeats }),
  setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
  setPlayerStats: (playerStats) => set({ playerStats }),
  selectTable: (selectedTableId) => set({ selectedTableId }),
  toggleLeaderboard: () => set((s) => ({ showLeaderboard: !s.showLeaderboard })),
  toggleChat: () => set((s) => ({ showChat: !s.showChat })),

  playMusic: (track: string) => {
    const state = get();
    // Same track already playing — don't restart
    if (state.musicTrack === track && state._audio) {
      if (state.musicMuted) return;
      state._audio.play().catch(() => {});
      set({ musicPlaying: true });
      return;
    }
    // Stop old audio
    if (state._audio) {
      state._audio.pause();
      state._audio.src = "";
    }
    const audio = new Audio(track);
    audio.loop = true;
    audio.volume = 0.3;
    if (!state.musicMuted) {
      audio.play().catch(() => {});
    }
    set({ _audio: audio, musicTrack: track, musicPlaying: !state.musicMuted });
  },

  toggleMusicMute: () => {
    const state = get();
    const newMuted = !state.musicMuted;
    if (state._audio) {
      if (newMuted) {
        state._audio.pause();
      } else {
        state._audio.play().catch(() => {});
      }
    }
    set({ musicMuted: newMuted, musicPlaying: !newMuted });
  },

  stopMusic: () => {
    const state = get();
    if (state._audio) {
      state._audio.pause();
      state._audio.src = "";
    }
    set({ _audio: null, musicTrack: null, musicPlaying: false });
  },
}));
