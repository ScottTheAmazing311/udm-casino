import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          dark: "#0a0a12",
          card: "#111118",
          border: "#1e1e2e",
          subtle: "#1a1a2e",
          gold: "#FFD700",
          red: "#FF6B6B",
          green: "#4ADE80",
          blue: "#60A5FA",
          purple: "#A78BFA",
          orange: "#FB923C",
          pink: "#F472B6",
        },
      },
      fontFamily: {
        display: ["var(--font-dm-serif)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      keyframes: {
        "dice-roll": {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "25%": { transform: "rotate(-15deg) scale(1.1)" },
          "75%": { transform: "rotate(15deg) scale(1.1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255,215,0,0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(255,215,0,0.3)" },
        },
        "card-deal": {
          "0%": { transform: "translateY(-30px) rotate(-5deg)", opacity: "0" },
          "100%": { transform: "translateY(0) rotate(0)", opacity: "1" },
        },
        "chip-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "dice-roll": "dice-roll 0.3s ease infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "card-deal": "card-deal 0.4s ease-out",
        "chip-bounce": "chip-bounce 0.6s ease-in-out",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
