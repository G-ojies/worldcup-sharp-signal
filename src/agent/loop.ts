import { config } from "../config.js";
import type { Feed } from "../txline/feed.js";
import { mayTrade, type ProofResult, type ProofVerifier } from "../txline/proofTypes.js";
import type { SettlementSink } from "../chain/settlement.js";
import { SharpDetector, type SharpSignal } from "../signal/detector.js";
import { openPosition, settlePosition, type Position } from "./positions.js";

/**
 * The autonomous agent. Once started it needs no human input:
 *
 *   tick ─▶ detect sharp move ─▶ VERIFY the update's Merkle proof
 *        ─▶ open paper position (anchored) ─▶ … ─▶ match ends
 *        ─▶ grade vs final score ─▶ settle (anchored)
 *
 * Verify-before-trade: a signal that fails proof verification is logged and
 * dropped — the agent never opens a position on data it can't prove is genuine
 * TxLINE output. Grading is triggered by the feed reporting GameState "ended".
 */

export interface AgentEvents {
  onSignal?(sig: SharpSignal, proof: ProofResult, label: string): void;
  onOpen?(pos: Position): void;
  onSettle?(pos: Position): void;
  onEnded?(fixtureId: number): void;
}

export interface AgentSummary {
  positions: Position[];
  signalsSeen: number;
  signalsVerified: number;
  signalsAdvisory: number;
  signalsRejected: number;
}

export class SharpAgent {
  private readonly detector: SharpDetector;
  private readonly positions: Position[] = [];
  private readonly openByFixture = new Map<number, Position[]>();
  private readonly endedFixtures = new Set<number>();
  private signalsSeen = 0;
  private signalsVerified = 0;
  private signalsAdvisory = 0;
  private signalsRejected = 0;

  constructor(
    private readonly feed: Feed,
    private readonly verifier: ProofVerifier,
    private readonly sink: SettlementSink,
    private readonly events: AgentEvents = {},
  ) {
    this.detector = new SharpDetector({
      window: config.detector.window,
      zThreshold: config.detector.zThreshold,
      minMovePp: config.detector.minMovePp,
    });
  }

  async run(signal?: AbortSignal): Promise<AgentSummary> {
    for await (const tick of this.feed.ticks(signal)) {
      // Grade a fixture the moment the feed reports it ended.
      if (tick.gameState === "ended" && !this.endedFixtures.has(tick.fixtureId)) {
        this.endedFixtures.add(tick.fixtureId);
        this.events.onEnded?.(tick.fixtureId);
        await this.gradeFixture(tick.fixtureId);
      }

      const sigs = this.detector.push(tick);
      for (const sig of sigs) {
        // Only act on the outcome the sharp money is backing (probability rising).
        if (sig.direction !== "up") continue;
        this.signalsSeen++;

        const label = await Promise.resolve(this.feed.describeFixture(sig.fixtureId));
        const proof = await this.verifier.verify(tick);
        this.events.onSignal?.(sig, proof, label);

        if (!mayTrade(proof)) {
          this.signalsRejected++;
          continue; // verify-before-trade: refuse to act on unproven/invalid data
        }
        if (proof.verified) this.signalsVerified++;
        else this.signalsAdvisory++; // permitted under advisory policy, flagged

        const pos = openPosition(sig, label, config.detector.stake, proof);
        pos.openRef = await this.sink.recordOpen(pos);
        this.positions.push(pos);
        const list = this.openByFixture.get(sig.fixtureId) ?? [];
        list.push(pos);
        this.openByFixture.set(sig.fixtureId, list);
        this.events.onOpen?.(pos);
      }
    }

    // Feed exhausted (mock) — settle anything still open using final scores.
    for (const fixtureId of this.openByFixture.keys()) {
      await this.gradeFixture(fixtureId);
    }

    return {
      positions: this.positions,
      signalsSeen: this.signalsSeen,
      signalsVerified: this.signalsVerified,
      signalsAdvisory: this.signalsAdvisory,
      signalsRejected: this.signalsRejected,
    };
  }

  private async gradeFixture(fixtureId: number): Promise<void> {
    const open = this.openByFixture.get(fixtureId);
    if (!open || open.length === 0) return;

    const final = await this.feed.finalScore(fixtureId);
    if (!final) return; // not resolvable yet; will retry at feed end
    const winner = await this.feed.resolveWinner(fixtureId, final.home, final.away);
    if (!winner) return; // orientation unknown; don't settle on a guess

    for (const pos of open) {
      if (pos.status === "settled") continue;
      const settled = settlePosition(pos, winner, final.home, final.away, Date.now());
      settled.result!.settleRef = await this.sink.recordSettle(settled, settled.result!);
      // replace in-place in the master list
      const idx = this.positions.findIndex((p) => p.id === pos.id);
      if (idx !== -1) this.positions[idx] = settled;
      this.events.onSettle?.(settled);
    }
    this.openByFixture.set(
      fixtureId,
      open.map((p) => this.positions.find((x) => x.id === p.id) ?? p),
    );
  }
}
