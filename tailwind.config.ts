import type { Config } from "tailwindcss";

/**
 * Dark "trading terminal" theme (brand deferred — see brand.md). Colors are
 * exposed as CSS variables in app/globals.css and referenced here so components
 * never hardcode hex values.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        panel: "hsl(var(--panel))",
        "panel-2": "hsl(var(--panel-2))",
        border: "hsl(var(--border))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        pos: "hsl(var(--pos))",
        neg: "hsl(var(--neg))",
        warn: "hsl(var(--warn))",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "slide-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 hsl(var(--accent) / 0.5)" },
          "100%": { boxShadow: "0 0 0 8px hsl(var(--accent) / 0)" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.35s cubic-bezier(0.22,1,0.36,1)",
        "pulse-ring": "pulse-ring 1s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
