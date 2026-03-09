"use client";

import {
  Target, Sparkles, Flame, Gem, Dice5, Moon, Zap, Clover,
  Joystick, Star, CircleDot, Orbit, LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Target, Sparkles, Flame, Gem, Dice5, Moon, Zap, Clover,
  Joystick, Star, CircleDot, Orbit,
};

export default function PlayerIcon({
  name,
  size = 20,
  color = "#fff",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const Icon = ICON_MAP[name] || Star;
  return <Icon size={size} color={color} strokeWidth={2.5} />;
}
