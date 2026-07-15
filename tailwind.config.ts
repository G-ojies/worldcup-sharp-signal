import type { Config } from "tailwindcss";

/**
 * Flat editorial dark theme — near-black surfaces, cream text, a single violet
 * accent. Colors live as CSS variables in app/globals.css and are referenced
 * here so components never hardcode hex values.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        "bg-2": "hsl(var(--bg-2))",
        panel: "hsl(var(--panel))",
        "panel-2": "hsl(var(--panel-2))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        "accent-fg": "hsl(var(--accent-fg))",
        cream: "hsl(var(--cream))",
        pos: "hsl(var(--pos))",
        neg: "hsl(var(--neg))",
        warn: "hsl(var(--warn))",
      },
      borderRadius: {
        card: "var(--radius)",
        control: "var(--radius-sm)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
