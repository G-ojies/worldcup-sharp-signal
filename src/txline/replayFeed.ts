import type { Feed } from "./feed.js";
import type { OddsPayload, PriceTick } from "./types.js";
import { toPriceTick } from "./normalize.js";
import { getOddsUpdates, getFinalGoals, getScoresSnapshot, getFixtures } from "./client.js";

/**
 * Replay feed — streams the REAL recorded StablePrice history of a finished World
 * Cup fixture through the same detector, verifier and grader the live agent uses.
 *
 * Why: (1) it proves the agent on genuine TxLINE data, not a synthetic script;
 * (2) it is reproducible for a demo video even when no match is currently in-play
 * (the listing notes matches end before judging). Every tick, proof and score
 * here is real — only the clock is compressed.
 *
 * Source: GET /api/odds/updates/{fixtureId}, filtered to the full-match 1X2
 * market and ordered by timestamp. Final score comes from the scores feed.
 */

const FULL_MATCH_1X2 = "1X2_PARTICIPANT_RESULT";

function isFullMatch1x2(o: OddsPayload): boolean {
  return (
    o.SuperOddsType === FULL_MATCH_1X2 &&
    (o.MarketPeriod === null || o.MarketPeriod === undefined || o.MarketPeriod === "") &&
    Array.isArray(o.Pct) &&
    o.Pct.length >= 3
  );
}

/** Pre-recorded odds + match metadata, so a demo replay needs no large download. */
export interface ReplayBundle {
  meta: { fixtureId: number; home: string; away: string; part1IsHome: boolean; finalHome: number; finalAway: number };
  odds: OddsPayload[];
}

export function createReplayFeed(
  fixtureId: number,
  opts?: { delayMs?: number; preloaded?: ReplayBundle },
): Feed {
  const delay = opts?.delayMs ?? 25;
  const pre = opts?.preloaded;
  let part1IsHome: boolean | undefined = pre?.meta.part1IsHome;
  let label = pre ? `${pre.meta.home} v ${pre.meta.away}` : `fixture ${fixtureId}`;
  let series: OddsPayload[] | null = null;
  let bundledFinal = pre ? { home: pre.meta.finalHome, away: pre.meta.finalAway } : null;

  /** Learn participant orientation + label. Prefer the fixtures snapshot (has team
   *  names); fall back to the scores feed for orientation if it has aged out. */
  async function loadMeta(): Promise<void> {
    if (part1IsHome !== undefined) return;
    const fx = (await getFixtures().catch(() => [])).find((f) => f.FixtureId === fixtureId);
    if (fx) {
      part1IsHome = fx.Participant1IsHome;
      label = `${fx.Participant1} v ${fx.Participant2}`;
      return;
    }
    const scores = await getScoresSnapshot(fixtureId).catch(() => []);
    const withMeta = scores.find((s) => typeof s.Participant1IsHome === "boolean");
    part1IsHome = withMeta?.Participant1IsHome ?? true;
  }

  async function loadSeries(): Promise<OddsPayload[]> {
    if (series) return series;
    const all = pre ? pre.odds : await getOddsUpdates(fixtureId);
    series = all.filter(isFullMatch1x2).sort((a, b) => a.Ts - b.Ts);
    return series;
  }

  return {
    kind: "mock", // behaves like an offline feed to the rest of the agent
    async *ticks(signal?: AbortSignal): AsyncGenerator<PriceTick> {
      await loadMeta();
      const updates = await loadSeries();
      for (const payload of updates) {
        if (signal?.aborted) return;
        const tick = toPriceTick(payload);
        if (tick) yield tick;
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      }
    },
    async finalScore(fx: number) {
      if (bundledFinal) return bundledFinal;
      await loadMeta();
      return getFinalGoals(fx, part1IsHome ?? true);
    },
    async resolveWinner(_fx: number, home: number, away: number) {
      await loadMeta();
      if (home === away) return "draw";
      const homeWon = home > away;
      return homeWon === (part1IsHome ?? true) ? "part1" : "part2";
    },
    describeFixture() {
      return label;
    },
  };
}
