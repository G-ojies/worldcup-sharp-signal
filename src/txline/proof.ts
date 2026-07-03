import { createHash } from "node:crypto";
import { config } from "../config.js";
import { getOddsValidation } from "./client.js";
import { validateOddsOnChain } from "../chain/txlineProgram.js";
import type { PriceTick } from "./types.js";
import type { ProofResult, ProofVerifier } from "./proofTypes.js";

export { mayTrade } from "./proofTypes.js";
export type { ProofResult, ProofStatus, ProofVerifier } from "./proofTypes.js";

/**
 * "Verify-before-trade" — the agent proves each odds update is genuine TxLINE
 * data BEFORE it is allowed to influence a position.
 *
 * The verification of record is the TxLINE program's on-chain `validate_odds`
 * instruction (see chain/txlineProgram.ts): fetch the update's Merkle proof from
 * GET /api/odds/validation, then have the oracle program re-derive the branch and
 * check it against the batch root committed on Solana. A read-only `.view()`.
 *
 * Statuses are reported honestly:
 *   verified   — validate_odds returned true (genuine, anchored). ✅ trade.
 *   rejected   — validate_odds returned false (proof invalid).    ⛔ never trade.
 *   unanchored — proof retrieved, but the odds root is not yet published on-chain
 *                (the devnet free tier today). Trade only under "advisory" policy.
 *   unavailable/error — proof or chain call could not be completed.
 *   mock       — synthetic feed; locally self-consistent anchor.
 */

export function createProofVerifier(): ProofVerifier {
  return config.feed.source === "mock" ? mockVerifier() : onChainVerifier();
}

function onChainVerifier(): ProofVerifier {
  return {
    kind: "onchain",
    async verify(tick: PriceTick): Promise<ProofResult> {
      // 1. Retrieve the update's Merkle proof from the oracle.
      let validation;
      try {
        validation = await getOddsValidation(tick.messageId, tick.tsMs);
      } catch (err) {
        return { status: "unavailable", verified: false, reason: `proof fetch: ${(err as Error).message.slice(0, 120)}` };
      }

      // 2. Optionally skip the chain hop (structural retrieval only).
      if (!config.verify.onChain) {
        return { status: "unanchored", verified: false, reason: "on-chain check disabled" };
      }

      // 3. Verify on-chain via validate_odds (read-only).
      const oc = await validateOddsOnChain(validation);
      const root = Buffer.from(validation.summary.oddsSubTreeRoot).toString("hex");
      switch (oc.status) {
        case "verified":
          return { status: "verified", verified: true, root, epochDay: oc.epochDay, pda: oc.pda };
        case "rejected":
          return { status: "rejected", verified: false, root, epochDay: oc.epochDay, pda: oc.pda };
        case "unanchored":
          return { status: "unanchored", verified: false, root, epochDay: oc.epochDay, pda: oc.pda, reason: oc.reason };
        default:
          return { status: "error", verified: false, root, epochDay: oc.epochDay, pda: oc.pda, reason: oc.reason };
      }
    },
  };
}

function mockVerifier(): ProofVerifier {
  return {
    kind: "mock",
    async verify(tick: PriceTick): Promise<ProofResult> {
      // Self-consistent local anchor: deterministic root over the payload, so the
      // gate runs end-to-end offline and yields a real 32-byte root for the ledger.
      const canonical = JSON.stringify({
        FixtureId: tick.raw.FixtureId,
        MessageId: tick.raw.MessageId,
        Ts: tick.raw.Ts,
        PriceNames: tick.raw.PriceNames ?? [],
        Prices: tick.raw.Prices ?? [],
      });
      const root = createHash("sha256").update(canonical).digest("hex");
      return { status: "mock", verified: true, root };
    },
  };
}
