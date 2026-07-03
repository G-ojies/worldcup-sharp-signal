import { config } from "../config.js";
import type { PriceTick } from "./types.js";

/**
 * Anchor-free proof types shared by the agent, the on-chain verifier, and the
 * lightweight web verifier. Kept separate from proof.ts so importers that must
 * not bundle @coral-xyz/anchor (e.g. serverless dashboard routes) can depend on
 * the contract without pulling the on-chain implementation.
 */

export type ProofStatus =
  | "verified"
  | "rejected"
  | "unanchored"
  | "unavailable"
  | "error"
  | "mock";

export interface ProofResult {
  status: ProofStatus;
  /** true only for a genuine on-chain (or mock) confirmation. */
  verified: boolean;
  /** hex batch/anchor root, when known. */
  root?: string;
  epochDay?: number;
  pda?: string;
  reason?: string;
}

export interface ProofVerifier {
  kind: "onchain" | "onchain-light" | "mock";
  verify(tick: PriceTick): Promise<ProofResult>;
}

/** Whether a result permits opening a position, given the configured policy. */
export function mayTrade(r: ProofResult): boolean {
  if (r.status === "rejected") return false; // invalid proof: never
  if (r.status === "verified" || r.status === "mock") return true;
  return config.verify.policy === "advisory"; // unanchored/unavailable/error
}
