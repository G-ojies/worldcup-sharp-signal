"use client";

import { motion } from "framer-motion";
import { Flag, Radio, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { SPRING } from "./motion";

/**
 * The agent pipeline as four flat cells that light as a run plays:
 *   Ingest → Detect → Verify → Settle
 * `stage` is the highest step reached (0=idle … 4=settled). Steps stay lit once
 * reached (stage >= N pattern); the current step shows a live violet dot.
 */

export interface PipelineMetrics {
  signals: number;
  checked: number;
  settled: number;
}

const STEPS: { n: number; key: string; title: string; sub: string; icon: LucideIcon }[] = [
  { n: 1, key: "ingest", title: "Ingest", sub: "StablePrice feed", icon: Radio },
  { n: 2, key: "detect", title: "Detect", sub: "z-score signal", icon: Zap },
  { n: 3, key: "verify", title: "Verify", sub: "validate_odds", icon: ShieldCheck },
  { n: 4, key: "settle", title: "Settle", sub: "final whistle", icon: Flag },
];

export function PipelineStages({ stage, metrics }: { stage: number; metrics: PipelineMetrics }) {
  const metricFor = (n: number): string =>
    n === 1
      ? stage >= 1
        ? "live"
        : "idle"
      : n === 2
        ? `${metrics.signals} signals`
        : n === 3
          ? `${metrics.checked} checked`
          : `${metrics.settled} settled`;

  return (
    <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {STEPS.map((s, i) => {
        const active = stage >= s.n;
        const current = stage === s.n;
        const Icon = s.icon;
        return (
          <li key={s.key}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING.smooth, delay: 0.05 * i }}
              className={`rounded-card border p-4 transition-colors duration-200 ease-out ${
                active ? "border-border-strong bg-panel" : "border-border bg-panel/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="label tracking-[0.18em]">{String(s.n).padStart(2, "0")}</span>
                {current && (
                  <span className="relative flex h-1.5 w-1.5" aria-label="current stage">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" aria-hidden />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                )}
              </div>

              <Icon
                className={`mt-4 h-5 w-5 transition-colors duration-200 ease-out ${active ? "text-accent" : "text-muted"}`}
                strokeWidth={1.5}
                aria-hidden
              />

              <div className={`mt-3 text-sm font-medium ${active ? "text-fg" : "text-muted"}`}>{s.title}</div>
              <div className="mt-0.5 text-xs text-muted">{s.sub}</div>
              {/* muted at full strength — 10px is body text and needs 4.5:1 */}
              <div className={`label mt-3 text-[10px] ${active ? "text-fg" : ""}`}>{metricFor(s.n)}</div>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
