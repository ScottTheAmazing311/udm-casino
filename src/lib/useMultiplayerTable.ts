"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { BlackjackGameState, BlackjackPhase, Seat } from "./types";

interface TableState {
  phase: BlackjackPhase;
  state: BlackjackGameState;
  currentTurnPlayerId: number | null;
  version: number;
}

interface UseMultiplayerTableResult {
  seats: Seat[];
  gameState: TableState | null;
  loading: boolean;
  error: string | null;
  sendAction: (action: string, extra?: Record<string, unknown>) => Promise<void>;
  refreshSeats: () => Promise<void>;
}

export function useMultiplayerTable(
  tableId: string | null,
  playerId: number | null
): UseMultiplayerTableResult {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [gameState, setGameState] = useState<TableState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshSeats = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from("udm_seats")
      .select()
      .eq("table_id", tableId)
      .order("joined_at");
    if (data) setSeats(data as Seat[]);
  }, [tableId]);

  const refreshGameState = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from("udm_game_state")
      .select()
      .eq("table_id", tableId)
      .single();
    if (data) {
      setGameState({
        phase: data.phase as BlackjackPhase,
        state: data.state as BlackjackGameState,
        currentTurnPlayerId: data.current_turn_player_id,
        version: data.version,
      });
    }
  }, [tableId]);

  // Initial load
  useEffect(() => {
    if (!tableId) return;

    setLoading(true);
    Promise.all([refreshSeats(), refreshGameState()]).then(() => {
      setLoading(false);
    });
  }, [tableId, refreshSeats, refreshGameState]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!tableId) return;

    const channel = supabase
      .channel(`table-${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "udm_game_state",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          const data = payload.new as Record<string, unknown>;
          if (data) {
            setGameState({
              phase: data.phase as BlackjackPhase,
              state: data.state as BlackjackGameState,
              currentTurnPlayerId: data.current_turn_player_id as number | null,
              version: data.version as number,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "udm_seats",
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          refreshSeats();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [tableId, refreshSeats]);

  const sendAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      if (!tableId || !playerId) return;
      setError(null);

      try {
        const res = await fetch("/api/game/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableId,
            playerId,
            action,
            ...extra,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Action failed");
          return;
        }

        // State will be updated via realtime subscription
        // But also update locally for responsiveness
        if (data.state) {
          setGameState({
            phase: data.phase,
            state: data.state,
            currentTurnPlayerId: data.state?.turnOrder?.[data.state?.turnIndex] ?? null,
            version: data.version,
          });
        }

        // Refresh seats after results (chip changes)
        if (data.phase === "results" || action === "new-round") {
          refreshSeats();
        }
      } catch {
        setError("Network error");
      }
    },
    [tableId, playerId, refreshSeats]
  );

  return { seats, gameState, loading, error, sendAction, refreshSeats };
}
