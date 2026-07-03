"use client";

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
}: {
  series: SeriesPoint[];
  playIdx: number;
  signals: Extract<RunEvent, { type: "signal" }>[];
  meta: RunMeta;
}) {
  if (series.length < 2) return null;
  const t0 = series[0]!.t;
  const t1 = series[series.length - 1]!.t;
  const span = Math.max(1, t1 - t0);

  const px = (t: number) => PAD.left + ((t - t0) / span) * (W - PAD.left - PAD.right);
  const py = (pct: number) => PAD.top + (1 - pct / 100) * (H - PAD.top - PAD.bottom);

  const visible = series.slice(0, Math.max(2, playIdx + 1));
  const line = (key: "p1" | "draw" | "p2") =>
    visible.map((p) => `${px(p.t).toFixed(1)},${py(p[key]).toFixed(1)}`).join(" ");

  const playT = series[Math.min(playIdx, series.length - 1)]!.t;
  const playX = px(playT);

  // kickoff marker: first in-running point
  const kickoff = series.find((p) => p.inRunning);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Implied probability over time for ${meta.home} versus ${meta.away}`}
    >
      {/* horizontal gridlines every 25% */}
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={PAD.left} x2={W - PAD.right} y1={py(g)} y2={py(g)} stroke="hsl(var(--border))" strokeWidth={1} />
          <text x={4} y={py(g) + 4} fill="hsl(var(--muted))" fontSize={11} className="tnum">
            {g}
          </text>
        </g>
      ))}

      {/* kickoff divider */}
      {kickoff && (
        <g>
          <line x1={px(kickoff.t)} x2={px(kickoff.t)} y1={PAD.top} y2={H - PAD.bottom} stroke="hsl(var(--border))" strokeDasharray="3 4" strokeWidth={1} />
          <text x={px(kickoff.t) + 4} y={H - PAD.bottom - 6} fill="hsl(var(--muted))" fontSize={10}>
            kickoff
          </text>
        </g>
      )}

      {/* probability lines */}
      <polyline points={line("p2")} fill="none" stroke="hsl(var(--muted))" strokeWidth={1.5} opacity={0.7} />
      <polyline points={line("draw")} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} opacity={0.9} />
      <polyline points={line("p1")} fill="none" stroke="hsl(var(--accent))" strokeWidth={2.5} />

      {/* signal markers (only those the playhead has reached) */}
      {signals
        .filter((s) => s.tsMs <= playT + 1)
        .map((s, i) => {
          return (
            <g key={i}>
              <circle cx={px(s.tsMs)} cy={py(s.probAfter)} r={5} fill={proofColor(s.proofStatus)} stroke="hsl(var(--bg))" strokeWidth={2} />
              <circle cx={px(s.tsMs)} cy={py(s.probAfter)} r={9} fill="none" stroke={proofColor(s.proofStatus)} strokeWidth={1} opacity={0.4} />
            </g>
          );
        })}

      {/* playhead */}
      <line x1={playX} x2={playX} y1={PAD.top} y2={H - PAD.bottom} stroke="hsl(var(--accent))" strokeWidth={1} opacity={0.5} />
      <circle cx={playX} cy={py(series[Math.min(playIdx, series.length - 1)]!.p1)} r={3.5} fill="hsl(var(--accent))" />
    </svg>
  );
}
