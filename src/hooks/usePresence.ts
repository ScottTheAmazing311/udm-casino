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

    // Poll online players — only count those seen in the last 30s
    const fetchOnline = async () => {
      const staleThreshold = new Date(Date.now() - 30000).toISOString();
      const { data } = await supabase
        .from("udm_players")
        .select("id")
        .eq("is_online", true)
        .gte("last_seen_at", staleThreshold);
      if (data) {
        setOnlinePlayers(data.map((p) => p.id));
      }

      // Mark stale players as offline and remove their seats
      await supabase
        .from("udm_players")
        .update({ is_online: false })
        .eq("is_online", true)
        .lt("last_seen_at", staleThreshold);
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

    // Go offline on tab close
    const handleUnload = () => {
      navigator.sendBeacon?.(
        "/api/auth/offline",
        JSON.stringify({ playerId })
      );
    };
    window.addEventListener("beforeunload", handleUnload);

    // Go offline on unmount
    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
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
