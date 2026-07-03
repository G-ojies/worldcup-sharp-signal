import { config, assertLiveCredentials } from "../config.js";
import { liveFeed } from "./stream.js";
import { getFixtures, getFinalGoals } from "./client.js";
import { createMockFeed } from "./mockFeed.js";
import { createReplayFeed } from "./replayFeed.js";
import type { PriceTick } from "./types.js";

/**
 * Source-agnostic feed the agent runs against. A `live` feed streams real TxLINE
 * StablePrice odds over SSE and resolves final scores from the scores history; a
 * `mock` feed replays a deterministic synthetic slate. The rest of the codebase
 * only depends on this interface, so switching sources is a one-line change.
 */
export interface Feed {
  kind: "live" | "mock";
  /** Continuous stream of normalized price ticks across all followed fixtures. */
  ticks(signal?: AbortSignal): AsyncGenerator<PriceTick>;
  /** Final goals once a match has ended, or null if not yet resolvable. */
  finalScore(fixtureId: number): Promise<{ home: number; away: number } | null>;
  /**
   * The winning outcome for a final score, expressed in the SAME label vocabulary
   * the ticks use (mock: "Home"/"Draw"/"Away"; live: "part1"/"draw"/"part2").
   * Returns null if the fixture's participant orientation is unknown.
   */
  resolveWinner(fixtureId: number, home: number, away: number): Promise<string | null>;
  /** Human-readable label for logs/UI, e.g. "Brazil v Serbia". */
  describeFixture(fixtureId: number): string | Promise<string>;
}

/** Build the feed selected by SHARP_FEED (defaults to mock). */
export function createFeed(): Feed {
  if (config.feed.source === "live") {
    assertLiveCredentials();
    return createLiveFeed();
  }
  if (config.feed.source === "replay") {
    assertLiveCredentials();
    return createReplayFeed(config.feed.replayFixture);
  }
  return createMockFeed();
}

function createLiveFeed(): Feed {
  const labels = new Map<number, string>();
  const part1IsHome = new Map<number, boolean>();

  async function ensureFixtureMeta(fixtureId: number): Promise<void> {
    if (part1IsHome.has(fixtureId)) return;
    try {
      for (const f of await getFixtures()) {
        labels.set(f.FixtureId, `${f.Participant1} v ${f.Participant2}`);
        part1IsHome.set(f.FixtureId, f.Participant1IsHome);
      }
    } catch {
      /* best effort */
    }
  }

  return {
    kind: "live",
    ticks: (signal) => liveFeed(signal),

    async resolveWinner(fixtureId: number, home: number, away: number) {
      await ensureFixtureMeta(fixtureId);
      const p1Home = part1IsHome.get(fixtureId);
      if (p1Home === undefined) return null; // unknown orientation → don't guess
      if (home === away) return "draw";
      const homeWon = home > away;
      // part1 is the home side iff p1Home; the winner label follows the score.
      return homeWon === p1Home ? "part1" : "part2";
    },

    async finalScore(fixtureId: number) {
      await ensureFixtureMeta(fixtureId);
      const p1Home = part1IsHome.get(fixtureId);
      if (p1Home === undefined) return null;
      return getFinalGoals(fixtureId, p1Home);
    },

    async describeFixture(fixtureId: number) {
      if (!labels.has(fixtureId)) await ensureFixtureMeta(fixtureId);
      return labels.get(fixtureId) ?? `fixture ${fixtureId}`;
    },
  };
}
