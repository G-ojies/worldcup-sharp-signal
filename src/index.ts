import { config } from "./config.js";
import { createFeed } from "./txline/feed.js";
import { createProofVerifier } from "./txline/proof.js";
import { createSettlementSink } from "./chain/settlement.js";
import { SharpAgent, type AgentSummary } from "./agent/loop.js";
import type { Position } from "./agent/positions.js";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function fmtSigned(x: number): string {
  const s = x >= 0 ? `+${x.toFixed(2)}` : x.toFixed(2);
  return x >= 0 ? c.green(s) : c.red(s);
}

async function main(): Promise<void> {
  const feed = createFeed();
  const verifier = createProofVerifier();
  const sink = createSettlementSink();

  const src = config.feed.source;
  const feedDesc =
    src === "mock"
      ? "mock  (synthetic — no credentials needed)"
      : src === "replay"
        ? `replay  (real recorded odds, fixture ${config.feed.replayFixture})`
        : "live  (SSE StablePrice stream)";

  console.log(c.bold("\n⚡ SharpSignal — autonomous, proof-grounded steam-move agent\n"));
  console.log(`  ${c.dim("feed")}       ${feedDesc}`);
  console.log(
    `  ${c.dim("proof")}      ${verifier.kind === "onchain" ? "on-chain validate_odds" : "mock"}` +
      ` (verify-before-trade, ${config.verify.policy})`,
  );
  console.log(`  ${c.dim("settle")}     ${sink.kind}`);
  console.log(
    `  ${c.dim("detector")}   z≥${config.detector.zThreshold}  ` +
      `min move ${config.detector.minMovePp}pp  window ${config.detector.window}  stake ${config.detector.stake}\n`,
  );

  const agent = new SharpAgent(feed, verifier, sink, {
    onSignal(sig, proof, label) {
      const tag =
        proof.status === "verified"
          ? c.green("✓ on-chain verified")
          : proof.status === "rejected"
            ? c.red("✗ proof rejected")
            : proof.status === "mock"
              ? c.green("✓ verified (mock)")
              : c.yellow(`⚠ proof ${proof.status} (root pending)`);
      console.log(
        `  ${c.yellow("⚡ SHARP")} ${c.bold(label)} — ${c.cyan(sig.outcome)} ` +
          `${sig.probBefore.toFixed(1)}%→${sig.probAfter.toFixed(1)}% ` +
          `(${sig.movePp >= 0 ? "+" : ""}${sig.movePp}pp, z=${sig.z})  ${tag}`,
      );
    },
    onOpen(pos) {
      console.log(
        `    ${c.dim("→ open")} ${pos.outcome} @ ${pos.entryOdds} stake ${pos.stake} ` +
          `${c.dim("proof " + (pos.proofRoot?.slice(0, 12) ?? "n/a") + "…  ref " + (pos.openRef?.slice(0, 12) ?? "n/a"))}`,
      );
    },
    onSettle(pos) {
      const r = pos.result!;
      const verdict = r.won ? c.green("WON") : c.red("LOST");
      console.log(
        `  ${c.dim("● settle")} ${c.bold(pos.fixtureLabel)} ${r.finalHome}-${r.finalAway} ` +
          `→ backed ${pos.outcome}, ${verdict}  pnl ${fmtSigned(r.pnl)}`,
      );
    },
  });

  // Graceful shutdown for live mode (Ctrl-C prints the summary before exiting).
  const ac = new AbortController();
  process.on("SIGINT", () => {
    console.log(c.dim("\n\n  received SIGINT — settling & summarising…"));
    ac.abort();
  });

  const summary = await agent.run(ac.signal);
  printSummary(summary);
}

function printSummary(s: AgentSummary): void {
  const { positions, signalsSeen: seen, signalsVerified: verified, signalsAdvisory: advisory, signalsRejected: rejected } = s;
  const settled = positions.filter((p) => p.status === "settled");
  const wins = settled.filter((p) => p.result?.won).length;
  const pnl = settled.reduce((a, p) => a + (p.result?.pnl ?? 0), 0);
  const staked = settled.reduce((a, p) => a + p.stake, 0);
  const roi = staked > 0 ? (pnl / staked) * 100 : 0;

  console.log(c.bold("\n─── run summary ─────────────────────────────────────────"));
  console.log(
    `  signals            ${seen}  (${c.green(String(verified) + " verified")}, ` +
      `${c.yellow(String(advisory) + " advisory")}, ${c.red(String(rejected) + " rejected")})`,
  );
  console.log(`  positions opened   ${positions.length}`);
  console.log(`  settled            ${settled.length}  (${wins} won / ${settled.length - wins} lost)`);
  console.log(
    `  hit rate           ${settled.length ? ((wins / settled.length) * 100).toFixed(1) : "0.0"}%`,
  );
  console.log(`  net P&L            ${fmtSigned(Math.round(pnl * 100) / 100)}  (ROI ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%)`);
  console.log(c.dim("  ledger             data/ledger.jsonl"));
  console.log(c.bold("─────────────────────────────────────────────────────────\n"));
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exitCode = 1;
});
