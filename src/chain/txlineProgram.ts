import anchorPkg from "@coral-xyz/anchor";
import type { Idl, Program } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
import { config } from "../config.js";
import type { OddsValidation } from "../txline/types.js";

// @coral-xyz/anchor is CommonJS; under ESM its runtime exports live on the default
// import, so destructure the constructors from there (a bare `import * as` yields
// a namespace whose members are undefined at runtime).
const { BN, AnchorProvider, Wallet, Program: ProgramCtor } = anchorPkg;

const require = createRequire(import.meta.url);
const IDL = require("./txline_devnet.idl.json");

/**
 * On-chain verification against the TxLINE oracle program.
 *
 * `validate_odds(ts, odds_snapshot, summary, sub_tree_proof, main_tree_proof) -> bool`
 * reconstructs the odds update's Merkle branch and checks it against the batch
 * root committed in the `daily_odds_merkle_roots` PDA — returning true only if the
 * update was genuinely published by the TxODDS oracle. This is a read-only
 * `.view()` (transaction simulation), so it needs no funds and signs nothing.
 *
 * Devnet reality (confirmed 2026-07-03): the odds root PDA is NOT yet published on
 * the devnet free tier (only `daily_scores_roots` is). When the PDA is absent we
 * return `anchored:false` so the caller can decide policy, rather than pretending.
 * The instruction is correct and will verify against a real root on mainnet or once
 * devnet odds anchoring goes live — no code change needed.
 */

// TxLINE devnet program (from worldcup-match-vault integration; matches the IDL).
const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const ODDS_ROOTS_SEED = "daily_odds_roots"; // parallels the working "daily_scores_roots"

export type OnChainStatus = "verified" | "rejected" | "unanchored" | "error";

export interface OnChainResult {
  status: OnChainStatus;
  /** the boolean returned by validate_odds, when the call ran. */
  result?: boolean;
  epochDay: number;
  pda: string;
  reason?: string;
}

const bytes32 = (a: number[]): number[] => Array.from(Uint8Array.from(a));
const toNodes = (ns: OddsValidation["subTreeProof"]) =>
  (ns ?? []).map((n) => ({ hash: bytes32(n.hash), isRightSibling: n.isRightSibling }));

let programSingleton: Program | null = null;
function getProgram(): Program {
  if (programSingleton) return programSingleton;
  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  // Ephemeral wallet — .view() only simulates, so no keypair file or funds needed.
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  programSingleton = new ProgramCtor(IDL as Idl, provider);
  return programSingleton;
}

/** Derive the daily odds-roots PDA for the batch timestamp (ms). */
export function oddsRootPda(minTimestampMs: number): { pda: PublicKey; epochDay: number } {
  const epochDay = Math.floor(minTimestampMs / 86_400_000);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ODDS_ROOTS_SEED), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXLINE_PROGRAM,
  );
  return { pda, epochDay };
}

/** Map a TxLINE odds-validation response to `validate_odds` and run it read-only. */
export async function validateOddsOnChain(v: OddsValidation): Promise<OnChainResult> {
  const program = getProgram();
  const minTs = v.summary.updateStats.minTimestamp;
  const { pda, epochDay } = oddsRootPda(minTs);
  const base = { epochDay, pda: pda.toBase58() };

  const info = await program.provider.connection.getAccountInfo(pda).catch(() => null);
  if (!info) {
    return { ...base, status: "unanchored", reason: "daily_odds_roots PDA not published (devnet)" };
  }

  const o = v.odds;
  const oddsSnapshot = {
    fixtureId: new BN(o.FixtureId),
    messageId: o.MessageId,
    ts: new BN(o.Ts),
    bookmaker: o.Bookmaker,
    bookmakerId: o.BookmakerId,
    superOddsType: o.SuperOddsType,
    gameState: o.GameState ?? null,
    inRunning: o.InRunning,
    marketParameters: o.MarketParameters ?? null,
    marketPeriod: o.MarketPeriod ?? null,
    priceNames: o.PriceNames ?? [],
    prices: o.Prices ?? [],
  };
  const summary = {
    fixtureId: new BN(v.summary.fixtureId),
    updateStats: {
      updateCount: v.summary.updateStats.updateCount,
      minTimestamp: new BN(v.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
    },
    oddsSubTreeRoot: bytes32(v.summary.oddsSubTreeRoot),
  };
  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  try {
    const ok: boolean = await (program.methods as any)
      .validateOdds(new BN(minTs), oddsSnapshot, summary, toNodes(v.subTreeProof), toNodes(v.mainTreeProof))
      .accounts({ dailyOddsMerkleRoots: pda })
      .preInstructions([cu])
      .view();
    return { ...base, status: ok ? "verified" : "rejected", result: ok };
  } catch (err) {
    return { ...base, status: "error", reason: (err as Error).message.slice(0, 200) };
  }
}
