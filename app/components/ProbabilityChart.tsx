"use client";

import { useEffect, useState } from "react";
import type { RunMeta, RunEvent, SeriesPoint } from "../lib/types";

const W = 1000;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 28, left: 34 };

function proofColor(status: string): string {
  if (status === "verified") return "hsl(var(--pos))";
  if (status === "rejected") return "hsl(var(--neg))";
  return "hsl(var(--warn))";
}

export function ProbabilityChart({
  series,
  playIdx,
  signals,
  meta,
  instant = false,
}: {
  series: SeriesPoint[];
  playIdx: number;
  signals: Extract<RunEvent, { type: "signal" }>[];
  meta: RunMeta;
  /** true when the run jumps straight to the end (autorun/reduced-motion) — the
   *  home line then draws itself in with a stroke-dashoffset sweep. */
  instant?: boolean;
}) {
  // Trigger the one-shot draw-on the frame after mount (so the CSS transition runs).
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (series.length < 2) return null;
  const t0 = series[0]!.t;
  const t1 = series[series.length - 1]!.t;
  const span = Math.max(1, t1 - t0);

  const px = (t: number) => PAD.left + ((t - t0) / span) * (W - PAD.left - PAD.right);
  const py = (pct: number) => PAD.top + (1 - pct / 100) * (H - PAD.top - PAD.bottom);
  const baseY = py(0);

  const visible = series.slice(0, Math.max(2, playIdx + 1));
  const pts = (key: "p1" | "draw" | "p2") =>
    visible.map((p) => `${px(p.t).toFixed(1)},${py(p[key]).toFixed(1)}`).join(" ");
  const fullPts = (key: "p1" | "draw" | "p2") =>
    series.map((p) => `${px(p.t).toFixed(1)},${py(p[key]).toFixed(1)}`).join(" ");

  // area polygon under the home line
  const areaPts =
    visible.map((p) => `${px(p.t).toFixed(1)},${py(p.p1).toFixed(1)}`).join(" ") +
    ` ${px(visible[visible.length - 1]!.t).toFixed(1)},${baseY} ${px(visible[0]!.t).toFixed(1)},${baseY}`;

  const playT = series[Math.min(playIdx, series.length - 1)]!.t;
  const playX = px(playT);
  const playY = py(series[Math.min(playIdx, series.length - 1)]!.p1);
  const kickoff = series.find((p) => p.inRunning);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Implied probability over time for ${meta.home} versus ${meta.away}`}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines */}
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={PAD.left} x2={W - PAD.right} y1={py(g)} y2={py(g)} stroke="hsl(var(--border))" strokeWidth={1} />
          <text x={4} y={py(g) + 4} fill="hsl(var(--muted))" fontSize={11} className="tnum">
            {g}
          </text>
        </g>
      ))}

      {kickoff && (
        <g>
          <line x1={px(kickoff.t)} x2={px(kickoff.t)} y1={PAD.top} y2={baseY} stroke="hsl(var(--border))" strokeDasharray="3 4" strokeWidth={1} />
          <text x={px(kickoff.t) + 4} y={baseY - 6} fill="hsl(var(--muted))" fontSize={10}>
            kickoff
          </text>
        </g>
      )}

      {/* area + lines */}
      <polygon points={areaPts} fill="url(#areaGrad)" />
      <polyline points={pts("p2")} fill="none" stroke="hsl(var(--muted))" strokeWidth={1.5} opacity={0.65} />
      <polyline points={pts("draw")} fill="none" stroke="hsl(var(--border-strong))" strokeWidth={1.5} />
      {instant ? (
        // full line, revealed by a stroke-dashoffset sweep on mount
        <polyline
          points={fullPts("p1")}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      ) : (
        // playback: line grows point-by-point with the playhead
        <polyline points={pts("p1")} fill="none" stroke="hsl(var(--accent))" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* signal markers reached by the playhead */}
      {signals
        .filter((s) => s.tsMs <= playT + 1)
        .map((s, i) => (
          <g key={i}>
            <circle cx={px(s.tsMs)} cy={py(s.probAfter)} r={4.5} fill={proofColor(s.proofStatus)} stroke="hsl(var(--panel))" strokeWidth={2} />
            <circle cx={px(s.tsMs)} cy={py(s.probAfter)} r={9} fill="none" stroke={proofColor(s.proofStatus)} strokeWidth={1} opacity={0.3}>
              <animate attributeName="r" values="7;13;7" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}

      {/* playhead */}
      <line x1={playX} x2={playX} y1={PAD.top} y2={baseY} stroke="hsl(var(--accent))" strokeWidth={1} opacity={0.4} />
      <circle cx={playX} cy={playY} r={3.5} fill="hsl(var(--accent))" stroke="hsl(var(--panel))" strokeWidth={2} />
    </svg>
  );
}
