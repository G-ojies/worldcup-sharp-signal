import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { getOddsValidation } from "./client.js";
import type { ProofResult, ProofVerifier } from "./proofTypes.js";
import type { PriceTick } from "./types.js";

/**
 * Lightweight verify-before-trade for environments that must not bundle
 * @coral-xyz/anchor (serverless dashboard routes). Uses only @solana/web3.js.
 *
 * Same trust checks the on-chain path relies on, minus the program simulation:
 *   1. Retrieve the update's real Merkle proof (GET /api/odds/validation).
 *   2. Check whether the update's batch `daily_odds_roots` PDA exists on Solana.
 * PDA present  → the batch root is committed on-chain ("verified" at the anchoring
 *                level; the CLI's anchor verifier re-derives the branch for the
 *                full cryptographic check).
 * PDA absent   → "unanchored" (the devnet reality today), reported honestly.
 */

const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const ODDS_ROOTS_SEED = "daily_odds_roots";

let conn: Connection | null = null;
function connection(): Connection {
  if (!conn) conn = new Connection(config.solana.rpcUrl, "confirmed");
  return conn;
}

function oddsRootPda(minTimestampMs: number): { pda: PublicKey; epochDay: number } {
  const epochDay = Math.floor(minTimestampMs / 86_400_000);
  const day = Buffer.alloc(2);
  day.writeUInt16LE(epochDay & 0xffff, 0); // u16 LE seed, matches the CLI derivation
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from(ODDS_ROOTS_SEED), day], TXLINE_PROGRAM);
  return { pda, epochDay };
}

export function createLightVerifier(): ProofVerifier {
  return {
    kind: "onchain-light",
    async verify(tick: PriceTick): Promise<ProofResult> {
      let validation;
      try {
        validation = await getOddsValidation(tick.messageId, tick.tsMs);
      } catch (err) {
        return { status: "unavailable", verified: false, reason: `proof fetch: ${(err as Error).message.slice(0, 100)}` };
      }
      const root = Buffer.from(validation.summary.oddsSubTreeRoot).toString("hex");
      const { pda, epochDay } = oddsRootPda(validation.summary.updateStats.minTimestamp);

      try {
        const info = await connection().getAccountInfo(pda);
        return info
          ? { status: "verified", verified: true, root, epochDay, pda: pda.toBase58() }
          : { status: "unanchored", verified: false, root, epochDay, pda: pda.toBase58(), reason: "odds root not published (devnet)" };
      } catch (err) {
        return { status: "unanchored", verified: false, root, epochDay, pda: pda.toBase58(), reason: `pda check: ${(err as Error).message.slice(0, 80)}` };
      }
    },
  };
}
