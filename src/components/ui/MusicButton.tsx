"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useCasinoStore } from "@/lib/store/casino-store";

export default function MusicButton() {
  const { musicMuted, toggleMusicMute } = useCasinoStore();

  return (
    <button
      onClick={toggleMusicMute}
      className="w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.04)" }}
      title={musicMuted ? "Unmute" : "Mute"}
    >
      {musicMuted ? (
        <VolumeX size={14} className="text-[#555]" />
      ) : (
        <Volume2 size={14} className="text-casino-gold" />
      )}
    </button>
  );
}
