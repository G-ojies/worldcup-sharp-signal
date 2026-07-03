/**
 * Rolling per-outcome statistics for one fixture's market.
 *
 * For each outcome we keep a bounded window of recent per-update probability
 * changes ("deltas"). The window characterises the market's *normal* volatility;
 * a new delta that is many standard deviations outside that baseline is what we
 * call a sharp / steam move. Keeping the maths on the demargined implied
 * probability (TxLINE `Pct`) rather than raw odds makes the signal
 * bookmaker-margin-invariant and directly interpretable as "the market's belief
 * moved X percentage points".
 */

export interface WindowStats {
  mean: number;
  /** sample standard deviation (n-1); floored by the caller to avoid div/0. */
  std: number;
  n: number;
}

export class OutcomeState {
  private prevProb: number | undefined;
  private readonly deltas: number[] = [];
  /** hysteresis latch so a multi-tick move fires once, not every tick. */
  armed = true;

  constructor(private readonly window: number) {}

  /**
   * Record a new probability observation.
   * Returns the delta vs the previous observation (undefined on the first one),
   * WITHOUT yet adding it to the baseline window — so callers can score the delta
   * against the market's prior behaviour. Call {@link commit} to fold it in.
   */
  observe(prob: number): number | undefined {
    const delta = this.prevProb === undefined ? undefined : prob - this.prevProb;
    this.prevProb = prob;
    return delta;
  }

  /** Baseline stats over the window of PRIOR deltas (excludes the pending one). */
  baseline(): WindowStats {
    const n = this.deltas.length;
    if (n === 0) return { mean: 0, std: 0, n: 0 };
    let sum = 0;
    for (const d of this.deltas) sum += d;
    const mean = sum / n;
    if (n === 1) return { mean, std: 0, n };
    let sq = 0;
    for (const d of this.deltas) sq += (d - mean) ** 2;
    return { mean, std: Math.sqrt(sq / (n - 1)), n };
  }

  /** Fold a delta into the baseline window (evicting the oldest). */
  commit(delta: number): void {
    this.deltas.push(delta);
    if (this.deltas.length > this.window) this.deltas.shift();
  }

  get lastProb(): number | undefined {
    return this.prevProb;
  }
}

/** All outcome states for a single fixture's tracked market. */
export class FixtureState {
  private readonly outcomes = new Map<string, OutcomeState>();

  constructor(private readonly window: number) {}

  outcome(label: string): OutcomeState {
    let s = this.outcomes.get(label);
    if (!s) {
      s = new OutcomeState(this.window);
      this.outcomes.set(label, s);
    }
    return s;
  }
}
