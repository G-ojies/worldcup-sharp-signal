import { FixtureState } from "./state.js";
import type { PriceTick } from "../txline/types.js";

/**
 * Sharp-movement detector.
 *
 * Method (deterministic, no randomness, no ML black box):
 *   1. Track demargined implied probability per outcome from the StablePrice feed.
 *   2. For each new update, compute the single-step probability change (delta).
 *   3. Score that delta against the fixture's own recent volatility as a z-score:
 *          z = (delta - mean(recentDeltas)) / std(recentDeltas)
 *   4. Flag a SHARP move when |z| >= zThreshold AND |delta| >= minMovePp.
 *
 * Rationale: a genuine steam move is a probability shift that is large *relative
 * to how much this market has been moving* — an outlier in the fixture's own
 * distribution of ticks. Normalising by the market's recent std makes the same
 * threshold work for a volatile in-play market and a placid pre-match one, and
 * makes the signal defensible and reproducible from the raw feed alone.
 *
 * Hysteresis: the move usually plays out over several consecutive ticks. We latch
 * on the rising edge (fire once when z first crosses the threshold) and re-arm
 * only after z falls back below zThreshold/2, so one steam move => one signal.
 */

export interface DetectorParams {
  window: number;
  zThreshold: number;
  minMovePp: number;
}

export interface SharpSignal {
  fixtureId: number;
  market: string;
  outcome: string;
  tsMs: number;
  inRunning: boolean;
  gameState: string | undefined;
  probBefore: number;
  probAfter: number;
  /** signed percentage-point move (positive => probability rose). */
  movePp: number;
  z: number;
  direction: "up" | "down";
  baselineMean: number;
  baselineStd: number;
  samples: number;
}

export class SharpDetector {
  private readonly fixtures = new Map<number, FixtureState>();

  constructor(private readonly params: DetectorParams) {}

  /** Feed one tick; returns any sharp signals detected on this update. */
  push(tick: PriceTick): SharpSignal[] {
    let fs = this.fixtures.get(tick.fixtureId);
    if (!fs) {
      fs = new FixtureState(this.params.window);
      this.fixtures.set(tick.fixtureId, fs);
    }

    const signals: SharpSignal[] = [];
    const reArm = this.params.zThreshold / 2;

    for (const [outcome, prob] of Object.entries(tick.probs)) {
      const state = fs.outcome(outcome);
      const before = state.lastProb;
      const delta = state.observe(prob);
      if (delta === undefined) continue; // first observation for this outcome

      const base = state.baseline();
      // Need enough history for a meaningful baseline before we trust a z-score.
      const enoughHistory = base.n >= Math.min(8, this.params.window);
      const std = Math.max(base.std, 1e-6);
      const z = enoughHistory ? (delta - base.mean) / std : 0;

      const crosses = Math.abs(z) >= this.params.zThreshold && Math.abs(delta) >= this.params.minMovePp;

      if (enoughHistory && crosses && state.armed) {
        state.armed = false;
        signals.push({
          fixtureId: tick.fixtureId,
          market: tick.market,
          outcome,
          tsMs: tick.tsMs,
          inRunning: tick.inRunning,
          gameState: tick.gameState,
          probBefore: before ?? prob,
          probAfter: prob,
          movePp: round3(delta),
          z: round3(z),
          direction: delta >= 0 ? "up" : "down",
          baselineMean: round3(base.mean),
          baselineStd: round3(base.std),
          samples: base.n,
        });
      } else if (!state.armed && Math.abs(z) < reArm) {
        state.armed = true; // hysteresis re-arm
      }

      state.commit(delta);
    }

    return signals;
  }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
