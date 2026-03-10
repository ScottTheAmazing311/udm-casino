"use client";

import { useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useCasinoStore, CasinoTable, CasinoSeat, PlayerStats } from "@/lib/store/casino-store";

export function useCasinoFloor() {
  const {
    setCasinoTables,
    setCasinoSeats,
    setPlayerStats,
    casinoTables,
    casinoSeats,
    playerStats,
  } = useCasinoStore();

  const fetchTables = useCallback(async () => {
    const { data } = await supabase
      .from("udm_casino_tables")
      .select("*")
      .eq("is_active", true);
    if (data) setCasinoTables(data as CasinoTable[]);
  }, [setCasinoTables]);

  const fetchSeats = useCallback(async () => {
    const { data } = await supabase.from("udm_casino_seats").select("*");
    if (data) setCasinoSeats(data as CasinoSeat[]);
  }, [setCasinoSeats]);

  const fetchPlayerStats = useCallback(async () => {
    const { data } = await supabase
      .from("udm_players")
      .select("id, name, chips, chips_all_time_high, chips_all_time_low, total_hands_played, total_wins, total_losses, is_online")
      .order("chips", { ascending: false });
    if (data) setPlayerStats(data as PlayerStats[]);
  }, [setPlayerStats]);

  useEffect(() => {
    fetchTables();
    fetchSeats();
    fetchPlayerStats();

    // Subscribe to seat changes
    const seatChannel = supabase
      .channel("casino-seats-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "udm_casino_seats" },
        () => {
          fetchSeats();
        }
      )
      .subscribe();

    // Poll stats periodically
    const statsInterval = setInterval(fetchPlayerStats, 10000);

    return () => {
      supabase.removeChannel(seatChannel);
      clearInterval(statsInterval);
    };
  }, [fetchTables, fetchSeats, fetchPlayerStats]);

  const sitDown = useCallback(
    async (tableId: string, playerId: number) => {
      // Find next available seat number
      const tableSeats = casinoSeats.filter((s) => s.table_id === tableId);
      const table = casinoTables.find((t) => t.id === tableId);
      if (!table) return { error: "Table not found" };

      if (tableSeats.length >= table.max_seats) return { error: "Table full" };
      if (tableSeats.some((s) => s.player_id === playerId))
        return { error: "Already seated" };

      const takenSeats = new Set(tableSeats.map((s) => s.seat_number));
      let seatNum = 1;
      while (takenSeats.has(seatNum)) seatNum++;

      const { error } = await supabase.from("udm_casino_seats").insert({
        table_id: tableId,
        player_id: playerId,
        seat_number: seatNum,
      });

      if (error) return { error: error.message };
      await fetchSeats();
      return { success: true };
    },
    [casinoSeats, casinoTables, fetchSeats]
  );

  const standUp = useCallback(
    async (tableId: string, playerId: number) => {
      await supabase
        .from("udm_casino_seats")
        .delete()
        .eq("table_id", tableId)
        .eq("player_id", playerId);
      await fetchSeats();
    },
    [fetchSeats]
  );

  return {
    casinoTables,
    casinoSeats,
    playerStats,
    sitDown,
    standUp,
    refreshSeats: fetchSeats,
    refreshStats: fetchPlayerStats,
  };
}
