import type { Feed } from "./feed.js";
import type { OddsPayload, PriceTick } from "./types.js";
import { toPriceTick } from "./normalize.js";

/**
 * Deterministic synthetic StablePrice feed.
 *
 * Purpose: let the entire agent — ingestion, detection, grading, settlement —
 * run end-to-end with ZERO TxLINE credentials, and give the demo a reproducible
 * script that always contains a genuine "steam move" for the detector to catch.
 *
 * It emits payloads shaped exactly like real /api/odds/stream frames (PriceNames,
 * Prices, Pct, InRunning, GameState) so no downstream code knows it isn't live.
 */

// ── seeded PRNG (mulberry32) so runs are reproducible ────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OUTCOMES = ["Home", "Draw", "Away"] as const;

interface MockMatch {
  fixtureId: number;
  home: string;
  away: string;
  /** starting true probabilities (percent) for [Home, Draw, Away]. */
  base: [number, number, number];
  /** update index at which a sharp move fires. */
  steamAt: number;
  /** which outcome the sharp money backs. */
  steamOutcome: 0 | 1 | 2;
  /** signed magnitude (pp) applied over a few ticks. */
  steamPp: number;
  /** final result decided up-front so the grader can settle deterministically. */
  finalHomeGoals: number;
  finalAwayGoals: number;
}

const SLATE: MockMatch[] = [
  {
    fixtureId: 17271370,
    home: "Brazil",
    away: "Serbia",
    base: [58.0, 24.0, 18.0],
    steamAt: 40,
    steamOutcome: 0, // sharp money piles onto Brazil
    steamPp: 11.0,
    finalHomeGoals: 2,
    finalAwayGoals: 0,
  },
  {
    fixtureId: 17271402,
    home: "Japan",
    away: "Germany",
    base: [30.0, 27.0, 43.0],
    steamAt: 55,
    steamOutcome: 0, // upset steam toward Japan
    steamPp: 9.0,
    finalHomeGoals: 2,
    finalAwayGoals: 1,
  },
  {
    fixtureId: 17271455,
    home: "Argentina",
    away: "Mexico",
    base: [49.0, 26.0, 25.0],
    steamAt: 999, // no sharp move — control fixture, should NOT trigger
    steamOutcome: 1,
    steamPp: 0,
    finalHomeGoals: 1,
    finalAwayGoals: 1,
  },
];

const TICKS_PER_MATCH = 90; // ~ one per simulated minute
const BASE_TS = 1_770_000_000_000; // fixed epoch so runs are byte-identical

function encodePrices(probs: number[]): number[] {
  // integer-encoded decimal odds = round((100 / pct) * 1000)
  return probs.map((p) => Math.round((100 / Math.max(p, 0.01)) * 1000));
}

function renormalize(p: [number, number, number]): [number, number, number] {
  const s = p[0] + p[1] + p[2];
  return [(p[0] / s) * 100, (p[1] / s) * 100, (p[2] / s) * 100];
}

/** Build the full ordered payload script for one match. */
function scriptMatch(m: MockMatch): OddsPayload[] {
  const rng = mulberry32(m.fixtureId);
  const out: OddsPayload[] = [];
  let [pHome, pDraw, pAway] = m.base;
  const [bHome, bDraw, bAway] = m.base;

  for (let i = 0; i < TICKS_PER_MATCH; i++) {
    // gentle mean-reverting random walk (normal market noise)
    pHome += (rng() - 0.5) * 0.6 + (bHome - pHome) * 0.05;
    pDraw += (rng() - 0.5) * 0.6 + (bDraw - pDraw) * 0.05;
    pAway += (rng() - 0.5) * 0.6 + (bAway - pAway) * 0.05;

    // scripted sharp move: a fast, one-directional shift over 4 ticks that drains
    // proportionally from the other two outcomes.
    if (i >= m.steamAt && i < m.steamAt + 4 && m.steamPp !== 0) {
      const step = m.steamPp / 4;
      const drain = step / 2;
      if (m.steamOutcome === 0) { pHome += step; pDraw -= drain; pAway -= drain; }
      else if (m.steamOutcome === 1) { pDraw += step; pHome -= drain; pAway -= drain; }
      else { pAway += step; pHome -= drain; pDraw -= drain; }
    }

    let probs = renormalize([Math.max(pHome, 1), Math.max(pDraw, 1), Math.max(pAway, 1)]);
    [pHome, pDraw, pAway] = probs;

    const inRunning = i >= 5;
    const gameState = i < 5 ? "pre-match" : i >= TICKS_PER_MATCH - 1 ? "ended" : "in-play";
    out.push({
      FixtureId: m.fixtureId,
      MessageId: `${m.fixtureId}:${i}`,
      Ts: BASE_TS + i * 60_000,
      Bookmaker: "StablePrice",
      BookmakerId: 0,
      SuperOddsType: "1X2",
      GameState: gameState,
      InRunning: inRunning,
      MarketPeriod: "FT",
      PriceNames: [...OUTCOMES],
      Prices: encodePrices(probs),
      Pct: probs.map((p) => p.toFixed(3)),
    });
  }
  return out;
}

export function createMockFeed(opts?: { tickDelayMs?: number }): Feed {
  const delay = opts?.tickDelayMs ?? 120;
  const scripts = SLATE.map(scriptMatch);
  const finals = new Map<number, { home: number; away: number }>(
    SLATE.map((m) => [m.fixtureId, { home: m.finalHomeGoals, away: m.finalAwayGoals }]),
  );

  async function* ticks(signal?: AbortSignal): AsyncGenerator<PriceTick> {
    // interleave the three matches by round-robin so the agent sees concurrency
    for (let i = 0; i < TICKS_PER_MATCH; i++) {
      for (const script of scripts) {
        if (signal?.aborted) return;
        const payload = script[i];
        if (!payload) continue;
        const tick = toPriceTick(payload);
        if (tick) yield tick;
      }
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    kind: "mock",
    ticks,
    async finalScore(fixtureId: number) {
      return finals.get(fixtureId) ?? null;
    },
    async resolveWinner(_fixtureId: number, home: number, away: number) {
      // mock uses Home/Draw/Away labels, with Home == the home side by construction.
      if (home > away) return "Home";
      if (home < away) return "Away";
      return "Draw";
    },
    describeFixture(fixtureId: number) {
      const m = SLATE.find((x) => x.fixtureId === fixtureId);
      return m ? `${m.home} v ${m.away}` : `fixture ${fixtureId}`;
    },
  };
}
