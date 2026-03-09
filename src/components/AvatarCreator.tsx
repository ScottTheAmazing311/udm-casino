"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Shuffle, Check } from "lucide-react";
import {
  AvatarConfig,
  SKIN_COLORS,
  BG_COLORS,
  FACE_SHAPES,
  EYE_STYLES,
  MOUTH_STYLES,
  HAIR_STYLES,
  ACCESSORY_STYLES,
  getRandomAvatar,
} from "@/lib/avatar";
import { Player } from "@/lib/types";
import AvatarSVG from "./ui/AvatarSVG";

interface AvatarCreatorProps {
  player: Player;
  initialConfig?: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
}

type Category = "skin" | "face" | "eyes" | "mouth" | "hair" | "accessory" | "color";

const CATEGORIES: { key: Category; label: string; count: number }[] = [
  { key: "color", label: "Color", count: BG_COLORS.length },
  { key: "skin", label: "Skin", count: SKIN_COLORS.length },
  { key: "face", label: "Face", count: FACE_SHAPES.length },
  { key: "eyes", label: "Eyes", count: EYE_STYLES.length },
  { key: "mouth", label: "Mouth", count: MOUTH_STYLES.length },
  { key: "hair", label: "Hair", count: HAIR_STYLES.length },
  { key: "accessory", label: "Extra", count: ACCESSORY_STYLES.length },
];

export default function AvatarCreator({ player, initialConfig, onSave }: AvatarCreatorProps) {
  const [config, setConfig] = useState<AvatarConfig>(
    initialConfig || getRandomAvatar(player.color)
  );
  const [activeCategory, setActiveCategory] = useState<Category>("face");

  const getValue = (cat: Category): number => {
    switch (cat) {
      case "skin": return SKIN_COLORS.indexOf(config.skinColor);
      case "face": return config.faceShape;
      case "eyes": return config.eyes;
      case "mouth": return config.mouth;
      case "hair": return config.hair;
      case "accessory": return config.accessory;
      case "color": return BG_COLORS.indexOf(config.bgColor);
    }
  };

  const setValue = (cat: Category, val: number) => {
    const c = { ...config };
    switch (cat) {
      case "skin": c.skinColor = SKIN_COLORS[val]; break;
      case "face": c.faceShape = val; break;
      case "eyes": c.eyes = val; break;
      case "mouth": c.mouth = val; break;
      case "hair": c.hair = val; break;
      case "accessory": c.accessory = val; break;
      case "color": c.bgColor = BG_COLORS[val]; break;
    }
    setConfig(c);
  };

  const activeData = CATEGORIES.find((c) => c.key === activeCategory)!;
  const currentVal = getValue(activeCategory);

  const cycle = (dir: number) => {
    const next = (currentVal + dir + activeData.count) % activeData.count;
    setValue(activeCategory, next);
  };

  const randomize = () => {
    setConfig(getRandomAvatar(player.color));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 p-8"
    >
      <div className="text-center">
        <div className="text-[#666] text-xs uppercase tracking-[3px] mb-1">Welcome</div>
        <h2 className="text-2xl font-bold" style={{ color: player.color }}>
          {player.name}
        </h2>
        <div className="text-[#555] text-xs mt-1">Create your avatar</div>
      </div>

      {/* Avatar Preview */}
      <motion.div
        key={JSON.stringify(config)}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="relative"
      >
        <div
          className="rounded-full p-1"
          style={{
            background: `linear-gradient(135deg, ${config.bgColor}44, ${config.bgColor}22)`,
            boxShadow: `0 0 40px ${config.bgColor}22`,
          }}
        >
          <AvatarSVG config={config} size={120} />
        </div>
      </motion.div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap justify-center">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: activeCategory === cat.key ? `${player.color}22` : "#1a1a2e",
              color: activeCategory === cat.key ? player.color : "#666",
              border: `1px solid ${activeCategory === cat.key ? player.color + "44" : "#333"}`,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Selector */}
      <div className="flex items-center gap-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => cycle(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#1a1a2e", border: "1px solid #333" }}
        >
          <ChevronLeft size={20} color="#888" />
        </motion.button>

        <div className="text-center min-w-[60px]">
          <div className="text-white text-lg font-bold font-mono">
            {currentVal + 1}/{activeData.count}
          </div>
          <div className="text-[#555] text-[10px]">{activeData.label}</div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => cycle(1)}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#1a1a2e", border: "1px solid #333" }}
        >
          <ChevronRight size={20} color="#888" />
        </motion.button>
      </div>

      {/* Color swatches for skin/bg categories */}
      <AnimatePresence mode="wait">
        {(activeCategory === "skin" || activeCategory === "color") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 flex-wrap justify-center"
          >
            {(activeCategory === "skin" ? SKIN_COLORS : BG_COLORS).map((color, i) => (
              <button
                key={color}
                onClick={() => setValue(activeCategory, i)}
                className="w-8 h-8 rounded-full transition-all"
                style={{
                  background: color,
                  border: `2px solid ${currentVal === i ? "#fff" : "transparent"}`,
                  boxShadow: currentVal === i ? `0 0 12px ${color}66` : "none",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={randomize}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
          style={{ background: "#1a1a2e", border: "1px solid #333", color: "#888" }}
        >
          <Shuffle size={14} />
          Randomize
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSave(config)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white"
          style={{ background: player.color }}
        >
          <Check size={14} />
          Done
        </motion.button>
      </div>
    </motion.div>
  );
}
