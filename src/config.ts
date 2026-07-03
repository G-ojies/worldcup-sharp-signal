import "dotenv/config";

function num(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const v = Number(raw);
  if (!Number.isFinite(v)) {
    throw new Error(`Env ${name}="${raw}" is not a finite number`);
  }
  return v;
}

function str(name: string, def = ""): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? def : raw.trim();
}

export type FeedSource = "live" | "mock" | "replay";
/**
 * How to treat a signal whose odds proof could not be confirmed on-chain.
 *  - "strict":   drop it (production / mainnet default).
 *  - "advisory": open the position but flag it unverified (devnet/replay, where
 *                odds roots are not yet anchored — see chain/txlineProgram.ts).
 */
export type VerifyPolicy = "strict" | "advisory";

export const config = {
  txline: {
    origin: str("TXLINE_ORIGIN", "https://txline.txodds.com").replace(/\/+$/, ""),
    jwt: str("TXLINE_JWT"),
    apiToken: str("TXLINE_API_TOKEN"),
  },
  feed: {
    source: (str("SHARP_FEED", "mock") as FeedSource),
    /** Explicit fixtureIds to follow; empty => auto-discover in live mode. */
    fixtures: str("SHARP_FIXTURES")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    /** Fixture to replay in SHARP_FEED=replay (default: a finished WC match). */
    replayFixture: num("SHARP_REPLAY_FIXTURE", 18179552),
    /** ms between replayed ticks (0 = as fast as possible). */
    replayDelayMs: num("SHARP_REPLAY_DELAY_MS", 25),
  },
  verify: {
    /** call the on-chain validate_odds instruction (false = skip chain, structural only). */
    onChain: str("SHARP_VERIFY_ONCHAIN", "true") !== "false",
    policy: (str("SHARP_VERIFY_POLICY", "advisory") as VerifyPolicy),
  },
  solana: {
    cluster: str("SOLANA_CLUSTER", "devnet"),
    rpcUrl: str("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
    keypairPath: str("AGENT_KEYPAIR_PATH"),
    programId: str("SHARP_PROGRAM_ID"),
  },
  detector: {
    window: num("SHARP_WINDOW", 30),
    zThreshold: num("SHARP_Z_THRESHOLD", 3.0),
    minMovePp: num("SHARP_MIN_MOVE_PP", 1.5),
    stake: num("SHARP_STAKE", 100),
  },
} as const;

export function assertLiveCredentials(): void {
  if (!config.txline.apiToken) {
    throw new Error(
      "SHARP_FEED=live requires TXLINE_API_TOKEN (from POST /api/token/activate). " +
        "Set it in .env, or run with SHARP_FEED=mock to use the synthetic feed.",
    );
  }
}
