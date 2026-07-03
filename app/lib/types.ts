export interface RunMeta {
  fixtureId: number;
  home: string;
  away: string;
  competition: string;
  part1IsHome: boolean;
  finalHome: number;
  finalAway: number;
}

export interface SeriesPoint {
  t: number;
  p1: number;
  draw: number;
  p2: number;
  inRunning: boolean;
}

export type RunEvent =
  | {
      type: "signal";
      tsMs: number;
      outcome: string;
      probBefore: number;
      probAfter: number;
      movePp: number;
      z: number;
      proofStatus: string;
      verified: boolean;
      root?: string;
      pda?: string;
    }
  | { type: "open"; tsMs: number; outcome: string; entryOdds: number; stake: number }
  | { type: "settle"; tsMs: number; outcome: string; won: boolean; pnl: number; finalHome: number; finalAway: number };

export interface RunResponse {
  meta: RunMeta;
  detector: { window: number; zThreshold: number; minMovePp: number; stake: number };
  policy: string;
  verifier: string;
  series: SeriesPoint[];
  events: RunEvent[];
  summary: {
    signalsSeen: number;
    signalsVerified: number;
    signalsAdvisory: number;
    signalsRejected: number;
    opened: number;
    settled: number;
    won: number;
    pnl: number;
    roi: number;
  };
}

export interface FixtureRow {
  fixtureId: number;
  home: string;
  away: string;
  competition: string;
  startTime: number;
  state: "upcoming" | "started";
}

/** Map a 1X2 outcome label to a display name using the fixture's teams. */
export function outcomeLabel(outcome: string, meta: RunMeta): string {
  if (outcome === "part1") return meta.home;
  if (outcome === "part2") return meta.away;
  if (outcome === "draw") return "Draw";
  return outcome;
}
