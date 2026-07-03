/**
 * TypeScript mirrors of the TxLINE OpenAPI schemas we consume.
 * Source of truth: https://txline.txodds.com/docs/docs.yaml
 *
 * We deliberately type only the fields the agent reads. TxLINE payloads may carry
 * additional fields; unknown extras are preserved via the index signature so we
 * never drop data we later want to anchor/verify.
 */

/** A scheduled or in-play fixture. GET /api/fixtures/snapshot */
export interface Fixture {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  /** true => Participant1 is the home side. */
  Participant1IsHome: boolean;
  [extra: string]: unknown;
}

/**
 * A single StablePrice odds update.
 * GET /api/odds/snapshot/{fixtureId}, /api/odds/updates/{fixtureId}, SSE /api/odds/stream
 *
 * `Prices` are integer-encoded decimal odds; `Pct` are the DEMARGINED implied
 * probabilities as strings ("52.632" = 52.632%), or "NA" for quarter handicaps.
 * `PriceNames[i]` labels outcome i, aligned with `Prices[i]` / `Pct[i]`.
 */
export interface OddsPayload {
  FixtureId: number;
  MessageId: string;
  /** Unix ms timestamp of the update. */
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  /** Market family, e.g. the 1X2 / match-odds market. */
  SuperOddsType: string;
  /** Match phase reported by the feed (e.g. pre-match, in-play, ended). */
  GameState?: string;
  /** true => in-running (live) price. */
  InRunning: boolean;
  MarketParameters?: string;
  MarketPeriod?: string;
  /** Outcome labels, e.g. ["Home","Draw","Away"]. */
  PriceNames?: string[];
  /** Integer-encoded decimal odds, aligned to PriceNames. */
  Prices?: number[];
  /** Demargined implied probability per outcome, "%.3f" or "NA". */
  Pct?: string[];
  [extra: string]: unknown;
}

/** SSE envelope for the odds stream. GET /api/odds/stream */
export interface OddsStreamEvent {
  id?: string;
  event?: string;
  data: OddsPayload;
}

/**
 * A score update. GET /api/scores/snapshot/{fixtureId}, SSE /api/scores/stream.
 * Only the fields the grader needs are typed; the payload carries much more.
 */
export interface Scores {
  fixtureId: number;
  gameState?: string;
  startTime?: number;
  competitionId?: number;
  participant1Id?: number;
  participant2Id?: number;
  participant1IsHome?: boolean;
  ts?: number;
  seq?: number;
  /** Normalised soccer score container (see scoreSoccer for goals). */
  score?: unknown;
  scoreSoccer?: SoccerScore;
  statusSoccerId?: string;
  [extra: string]: unknown;
}

/** Best-effort shape of the soccer score block. Verified against a live payload
 *  during the access milestone; `home`/`away` goal counts are what the grader uses. */
export interface SoccerScore {
  home?: number;
  away?: number;
  [extra: string]: unknown;
}

/** One node on a Merkle proof branch. */
export interface ProofNode {
  /** 32-byte hash (JSON delivers it as a number[]). */
  hash: number[];
  isRightSibling: boolean;
}

/**
 * Response of GET /api/odds/validation?messageId=&ts= — the inputs to the
 * on-chain `validate_odds` instruction.
 */
export interface OddsValidation {
  odds: OddsPayload;
  summary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    oddsSubTreeRoot: number[];
  };
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
}

/**
 * A score update as delivered on the wire (PascalCase). `Stats` is a map of
 * statId -> value; statId "1"/"2" are Participant1/Participant2 total goals.
 * `Action` "game_finalised" marks the settled final.
 */
export interface ScoreUpdate {
  FixtureId: number;
  Seq: number;
  Ts?: number;
  Action?: string;
  Participant1IsHome?: boolean;
  Stats?: Record<string, number>;
  [extra: string]: unknown;
}

/** A parsed, source-agnostic price tick the rest of the agent operates on. */
export interface PriceTick {
  fixtureId: number;
  messageId: string;
  tsMs: number;
  market: string;
  inRunning: boolean;
  gameState: string | undefined;
  /** outcome label -> demargined implied probability in PERCENT (e.g. 52.632). */
  probs: Record<string, number>;
  /** The raw payload, retained so we can request/verify its Merkle proof. */
  raw: OddsPayload;
}
