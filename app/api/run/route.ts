import { NextResponse } from "next/server";
import { createReplayFeed, type ReplayBundle } from "../../../src/txline/replayFeed.js";
import { createLightVerifier } from "../../../src/txline/proofLight.js";
import { MemorySettlementSink } from "../../../src/chain/settlement.js";
import { SharpAgent } from "../../../src/agent/loop.js";
import { config } from "../../../src/config.js";
import bundleJson from "../../../data/replay/18179552.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run the autonomous agent over a real recorded World Cup fixture and return the
 * full run for the client to play back. Odds are genuine TxLINE StablePrice data
 * (recorded); the verify-before-trade proof check hits TxLINE + Solana LIVE per
 * signal, so the on-chain status shown is real.
 */
export async function GET() {
  const bundle = bundleJson as unknown as ReplayBundle;

  const feed = createReplayFeed(bundle.meta.fixtureId, { delayMs: 0, preloaded: bundle });
  const verifier = createLightVerifier();
  const sink = new MemorySettlementSink();

  type Event =
    | { type: "signal"; tsMs: number; outcome: string; probBefore: number; probAfter: number; movePp: number; z: number; proofStatus: string; verified: boolean; root?: string; pda?: string }
    | { type: "open"; tsMs: number; outcome: string; entryOdds: number; stake: number }
    | { type: "settle"; tsMs: number; outcome: string; won: boolean; pnl: number; finalHome: number; finalAway: number };
  const events: Event[] = [];

  const agent = new SharpAgent(feed, verifier, sink, {
    onSignal(sig, proof) {
      events.push({
        type: "signal", tsMs: sig.tsMs, outcome: sig.outcome,
        probBefore: sig.probBefore, probAfter: sig.probAfter, movePp: sig.movePp, z: sig.z,
        proofStatus: proof.status, verified: proof.verified, root: proof.root, pda: proof.pda,
      });
    },
    onOpen(pos) {
      events.push({ type: "open", tsMs: pos.openedAtMs, outcome: pos.outcome, entryOdds: pos.entryOdds, stake: pos.stake });
    },
    onSettle(pos) {
      const r = pos.result!;
      events.push({ type: "settle", tsMs: r.settledAtMs, outcome: pos.outcome, won: r.won, pnl: r.pnl, finalHome: r.finalHome, finalAway: r.finalAway });
    },
  });

  const summary = await agent.run();

  // Downsample the probability series for the client chart (~200 points).
  const odds = bundle.odds.filter((o) => Array.isArray(o.Pct) && o.Pct.length >= 3).sort((a, b) => a.Ts - b.Ts);
  const stride = Math.max(1, Math.floor(odds.length / 200));
  const series = odds
    .filter((_, i) => i % stride === 0)
    .map((o) => ({
      t: o.Ts,
      p1: Number(o.Pct![0]),
      draw: Number(o.Pct![1]),
      p2: Number(o.Pct![2]),
      inRunning: o.InRunning,
    }));

  const settled = summary.positions.filter((p) => p.status === "settled");
  const pnl = settled.reduce((a, p) => a + (p.result?.pnl ?? 0), 0);
  const staked = settled.reduce((a, p) => a + p.stake, 0);

  return NextResponse.json({
    meta: bundle.meta,
    detector: config.detector,
    policy: config.verify.policy,
    verifier: verifier.kind,
    series,
    events,
    summary: {
      signalsSeen: summary.signalsSeen,
      signalsVerified: summary.signalsVerified,
      signalsAdvisory: summary.signalsAdvisory,
      signalsRejected: summary.signalsRejected,
      opened: summary.positions.length,
      settled: settled.length,
      won: settled.filter((p) => p.result?.won).length,
      pnl: Math.round(pnl * 100) / 100,
      roi: staked > 0 ? Math.round((pnl / staked) * 1000) / 10 : 0,
    },
  });
}
