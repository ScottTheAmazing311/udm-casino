import { create } from "zustand";

export interface CasinoTable {
  id: string;
  game_type: "blackjack" | "poker" | "craps";
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
}

export const useCasinoStore = create<CasinoState>((set) => ({
  playerId: null,
  playerName: null,
  casinoTables: [],
  casinoSeats: [],
  onlinePlayers: [],
  playerStats: [],
  selectedTableId: null,
  showLeaderboard: false,
  showChat: false,

  setSession: (playerId, playerName) => set({ playerId, playerName }),
  clearSession: () => set({ playerId: null, playerName: null }),
  setCasinoTables: (casinoTables) => set({ casinoTables }),
  setCasinoSeats: (casinoSeats) => set({ casinoSeats }),
  setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
  setPlayerStats: (playerStats) => set({ playerStats }),
  selectTable: (selectedTableId) => set({ selectedTableId }),
  toggleLeaderboard: () => set((s) => ({ showLeaderboard: !s.showLeaderboard })),
  toggleChat: () => set((s) => ({ showChat: !s.showChat })),
}));
