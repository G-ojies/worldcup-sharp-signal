import type { SharpSignal } from "../signal/detector.js";

/** A paper position opened in response to a verified sharp signal. */
export interface Position {
  id: string;
  fixtureId: number;
  fixtureLabel: string;
  market: string;
  /** the outcome we backed (the side the sharp move favoured). */
  outcome: string;
  openedAtMs: number;
  /** demargined implied probability at entry (percent). */
  entryProb: number;
  /** decimal odds locked at entry (100 / entryProb). */
  entryOdds: number;
  stake: number;
  z: number;
  movePp: number;
  /** hex Merkle root of the triggering update's TxLINE proof. */
  proofRoot: string | undefined;
  /** verify-before-trade outcome: "verified" | "unanchored" | "mock" | … */
  proofStatus: string;
  /** true only when the proof was confirmed on-chain (or mock). */
  proofVerified: boolean;
  /** settlement ref for the opening anchor (tx sig or local hash). */
  openRef: string | undefined;
  status: "open" | "settled";
  result?: PositionResult;
}

export interface PositionResult {
  finalHome: number;
  finalAway: number;
  winningOutcome: string;
  won: boolean;
  /** profit/loss in stake units (won => stake*(odds-1), lost => -stake). */
  pnl: number;
  settledAtMs: number;
  settleRef: string | undefined;
}

export function decimalOdds(probPercent: number): number {
  return 100 / Math.max(probPercent, 0.01);
}

let seq = 0;
export function openPosition(
  signal: SharpSignal,
  fixtureLabel: string,
  stake: number,
  proof: { root?: string; status: string; verified: boolean },
): Position {
  const odds = decimalOdds(signal.probAfter);
  return {
    id: `pos-${signal.fixtureId}-${signal.outcome}-${seq++}`,
    fixtureId: signal.fixtureId,
    fixtureLabel,
    market: signal.market,
    outcome: signal.outcome,
    openedAtMs: signal.tsMs,
    entryProb: signal.probAfter,
    entryOdds: Math.round(odds * 1000) / 1000,
    stake,
    z: signal.z,
    movePp: signal.movePp,
    proofRoot: proof.root,
    proofStatus: proof.status,
    proofVerified: proof.verified,
    openRef: undefined,
    status: "open",
  };
}

/**
 * Settle a position against a final score, computing PnL.
 * `winner` is the winning outcome label in the tick vocabulary (resolved by the
 * feed, e.g. "Home"/"Draw"/"Away" or "part1"/"draw"/"part2"), so this comparison
 * is correct for both the mock and live label schemes.
 */
export function settlePosition(
  pos: Position,
  winner: string,
  home: number,
  away: number,
  settledAtMs: number,
): Position {
  const won = pos.outcome === winner;
  const pnl = won ? pos.stake * (pos.entryOdds - 1) : -pos.stake;
  return {
    ...pos,
    status: "settled",
    result: {
      finalHome: home,
      finalAway: away,
      winningOutcome: winner,
      won,
      pnl: Math.round(pnl * 100) / 100,
      settledAtMs,
      settleRef: undefined,
    },
  };
}
