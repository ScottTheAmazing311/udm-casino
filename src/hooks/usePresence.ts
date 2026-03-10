"use client";

import { useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useCasinoStore } from "@/lib/store/casino-store";

export function usePresence(playerId: number | null) {
  const { setOnlinePlayers } = useCasinoStore();

  useEffect(() => {
    if (!playerId) return;

    // Mark online
    supabase
      .from("udm_players")
      .update({ is_online: true, last_seen_at: new Date().toISOString() })
      .eq("id", playerId)
      .then();

    // Poll online players
    const fetchOnline = async () => {
      const { data } = await supabase
        .from("udm_players")
        .select("id")
        .eq("is_online", true);
      if (data) {
        setOnlinePlayers(data.map((p) => p.id));
      }
    };

    fetchOnline();
    const interval = setInterval(fetchOnline, 5000);

    // Heartbeat
    const heartbeat = setInterval(() => {
      supabase
        .from("udm_players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", playerId)
        .then();
    }, 15000);

    // Go offline on unmount
    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
      supabase
        .from("udm_players")
        .update({ is_online: false })
        .eq("id", playerId)
        .then();
    };
  }, [playerId, setOnlinePlayers]);

  const goOffline = useCallback(() => {
    if (!playerId) return;
    supabase
      .from("udm_players")
      .update({ is_online: false })
      .eq("id", playerId)
      .then();
  }, [playerId]);

  return { goOffline };
}
