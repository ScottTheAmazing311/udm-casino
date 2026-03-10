"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CasinoSeat } from "@/lib/store/casino-store";

interface GameSession {
  id: string;
  table_id: string;
  game_type: string;
  status: string;
  game_state: Record<string, unknown>;
  current_turn_player_id: number | null;
  round_number: number;
  version: number;
}

export function useGameSession(tableId: string, playerId: number) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [seats, setSeats] = useState<CasinoSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current session and seats
  const refresh = useCallback(async () => {
    const [sessionRes, seatsRes] = await Promise.all([
      supabase
        .from("udm_game_sessions")
        .select("*")
        .eq("table_id", tableId)
        .neq("status", "complete")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("udm_casino_seats")
        .select("*")
        .eq("table_id", tableId)
        .order("seat_number"),
    ]);

    if (sessionRes.data) setSession(sessionRes.data);
    if (seatsRes.data) setSeats(seatsRes.data);
    setLoading(false);
  }, [tableId]);

  useEffect(() => {
    refresh();

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel(`game-session-${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "udm_game_sessions",
          filter: `table_id=eq.${tableId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSession(null);
          } else {
            setSession(payload.new as GameSession);
          }
        }
      )
      .subscribe();

    // Subscribe to seat changes
    const seatChannel = supabase
      .channel(`casino-seats-${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "udm_casino_seats",
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          // Refetch all seats for this table
          supabase
            .from("udm_casino_seats")
            .select("*")
            .eq("table_id", tableId)
            .order("seat_number")
            .then(({ data }) => {
              if (data) setSeats(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(seatChannel);
    };
  }, [tableId, refresh]);

  const sendAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      setError(null);
      try {
        const res = await fetch("/api/casino/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId, playerId, action, payload }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Action failed");
        }
        return data;
      } catch {
        setError("Network error");
      }
    },
    [tableId, playerId]
  );

  const startGame = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/casino/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, playerId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to start");
      return data;
    } catch {
      setError("Network error");
    }
  }, [tableId, playerId]);

  return {
    session,
    seats,
    loading,
    error,
    sendAction,
    startGame,
    refresh,
  };
}
