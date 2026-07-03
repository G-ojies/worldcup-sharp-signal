import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../config.js";
import type { Position, PositionResult } from "../agent/positions.js";

/**
 * Where the agent's decisions are recorded. Each signal→position→settlement is an
 * auditable event. Two implementations:
 *   - LocalSettlementSink: appends to a JSONL ledger and returns a content hash
 *     as the reference. Zero-dependency; used in mock mode and before the program
 *     is deployed.
 *   - (task 6) DevnetSettlementSink: submits Anchor txs to a devnet program so
 *     positions literally settle on-chain; the reference becomes the tx signature.
 *
 * The agent depends only on this interface, so wiring the real program in later
 * is a factory change with no loop rewrite.
 */
export interface SettlementSink {
  kind: "local" | "devnet";
  /** Anchor the decision to open a position (returns a reference id). */
  recordOpen(pos: Position): Promise<string>;
  /** Anchor the settlement of a position (returns a reference id). */
  recordSettle(pos: Position, result: PositionResult): Promise<string>;
}

const LEDGER_PATH = "data/ledger.jsonl";

function contentHash(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 32);
}

export class LocalSettlementSink implements SettlementSink {
  readonly kind = "local" as const;
  private ready: Promise<void> | null = null;

  private async ensureDir(): Promise<void> {
    if (!this.ready) this.ready = mkdir(dirname(LEDGER_PATH), { recursive: true }).then(() => {});
    return this.ready;
  }

  private async append(event: Record<string, unknown>): Promise<string> {
    await this.ensureDir();
    const ref = contentHash(event);
    await appendFile(LEDGER_PATH, JSON.stringify({ ...event, ref }) + "\n", "utf8");
    return ref;
  }

  recordOpen(pos: Position): Promise<string> {
    return this.append({
      type: "open",
      posId: pos.id,
      fixtureId: pos.fixtureId,
      outcome: pos.outcome,
      entryProb: pos.entryProb,
      entryOdds: pos.entryOdds,
      stake: pos.stake,
      z: pos.z,
      proofRoot: pos.proofRoot,
      proofStatus: pos.proofStatus,
      proofVerified: pos.proofVerified,
      ts: pos.openedAtMs,
    });
  }

  recordSettle(pos: Position, result: PositionResult): Promise<string> {
    return this.append({
      type: "settle",
      posId: pos.id,
      fixtureId: pos.fixtureId,
      outcome: pos.outcome,
      winningOutcome: result.winningOutcome,
      won: result.won,
      pnl: result.pnl,
      finalScore: `${result.finalHome}-${result.finalAway}`,
      ts: result.settledAtMs,
    });
  }
}

/**
 * In-memory sink for serverless environments (read-only filesystem) and the
 * dashboard. Returns a content-hash reference like the file sink, but keeps the
 * ledger in memory instead of writing to disk.
 */
export class MemorySettlementSink implements SettlementSink {
  readonly kind = "local" as const;
  readonly events: Record<string, unknown>[] = [];

  private record(event: Record<string, unknown>): string {
    const ref = contentHash(event);
    this.events.push({ ...event, ref });
    return ref;
  }

  async recordOpen(pos: Position): Promise<string> {
    return this.record({ type: "open", posId: pos.id, fixtureId: pos.fixtureId, outcome: pos.outcome, ts: pos.openedAtMs });
  }
  async recordSettle(pos: Position, result: PositionResult): Promise<string> {
    return this.record({ type: "settle", posId: pos.id, won: result.won, pnl: result.pnl, ts: result.settledAtMs });
  }
}

export function createSettlementSink(): SettlementSink {
  // TODO(task 6): if config.solana.programId && keypair present, return
  // DevnetSettlementSink so positions settle on-chain. Local until then.
  if (config.solana.programId && config.solana.keypairPath) {
    // Deliberately not silently pretending: surface that on-chain isn't wired yet.
    console.warn(
      "[settlement] SHARP_PROGRAM_ID set but DevnetSettlementSink not yet implemented (task 6); using local ledger.",
    );
  }
  return new LocalSettlementSink();
}
