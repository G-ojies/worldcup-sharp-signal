"use client";

import { motion } from "framer-motion";
import { SPRING } from "./motion";

/**
 * The agent pipeline as four animated "slides" that activate as a run plays:
 *   Ingest → Detect → Verify → Settle
 * `stage` is the highest step reached (0=idle … 4=settled). Steps stay lit once
 * reached (stage >= N pattern); the newest active step pulses.
 */

export interface PipelineMetrics {
  signals: number;
  checked: number;
  settled: number;
}

const STEPS = [
  { n: 1, key: "ingest", title: "Ingest", sub: "StablePrice feed", glyph: "📡" },
  { n: 2, key: "detect", title: "Detect", sub: "z-score signal", glyph: "⚡" },
  { n: 3, key: "verify", title: "Verify", sub: "validate_odds", glyph: "🛡" },
  { n: 4, key: "settle", title: "Settle", sub: "final whistle", glyph: "🏁" },
] as const;

export function PipelineStages({ stage, metrics }: { stage: number; metrics: PipelineMetrics }) {
  const metricFor = (n: number): string =>
    n === 1
      ? stage >= 1 ? "live" : "—"
      : n === 2
        ? `${metrics.signals} signals`
        : n === 3
          ? `${metrics.checked} checked`
          : `${metrics.settled} settled`;

  const progress = Math.max(0, Math.min(1, (stage - 1) / (STEPS.length - 1)));

  return (
    <div className="relative">
      {/* connector track (md+) */}
      <div className="pointer-events-none absolute left-[12%] right-[12%] top-9 hidden h-px bg-border md:block">
        <motion.div
          className="h-full origin-left bg-brand"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={SPRING.smooth}
        />
      </div>

      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEPS.map((s, i) => {
          const active = stage >= s.n;
          const current = stage === s.n;
          return (
            <li key={s.key}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.smooth, delay: 0.05 * i }}
                className={`card flex flex-col items-center gap-2 px-3 py-4 text-center transition-colors duration-300 ${
                  active ? "glow-accent" : "opacity-70"
                }`}
              >
                <motion.div
                  animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={current ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full text-lg ${
                    active ? "bg-brand text-bg" : "bg-panel-2 text-muted"
                  }`}
                >
                  <span aria-hidden>{s.glyph}</span>
                  {current && (
                    <span className="absolute inset-0 animate-pulse-ring rounded-full" aria-hidden />
                  )}
                </motion.div>
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-[11px] text-muted">{s.sub}</div>
                <div className={`tnum text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
                  {metricFor(s.n)}
                </div>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
