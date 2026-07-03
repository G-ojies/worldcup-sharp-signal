import type { Config } from "tailwindcss";

/**
 * Dark "trading terminal" theme (brand deferred — see brand.md). Colors live as
 * CSS variables in app/globals.css and are referenced here so components never
 * hardcode hex values.
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
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        "accent-2": "hsl(var(--accent-2))",
        pos: "hsl(var(--pos))",
        neg: "hsl(var(--neg))",
        warn: "hsl(var(--warn))",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        brand: "var(--grad-brand)",
        "grad-pos": "var(--grad-pos)",
      },
      boxShadow: {
        glow: "0 8px 40px -12px hsl(var(--accent) / 0.4)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 hsl(var(--accent) / 0.5)" },
          "100%": { boxShadow: "0 0 0 8px hsl(var(--accent) / 0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
