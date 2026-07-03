import { test } from "node:test";
import assert from "node:assert/strict";
import { SharpDetector } from "./detector.js";
import type { PriceTick } from "../txline/types.js";

function tick(fixtureId: number, ts: number, probs: Record<string, number>): PriceTick {
  return {
    fixtureId,
    messageId: `${fixtureId}:${ts}`,
    tsMs: ts,
    market: "1X2",
    inRunning: true,
    gameState: "in-play",
    probs,
    raw: {} as never,
  };
}

const params = { window: 30, zThreshold: 3.0, minMovePp: 1.5 };

test("stays silent on quiet, noise-only markets", () => {
  const d = new SharpDetector(params);
  let fired = 0;
  const rng = mulberry(1);
  let home = 50;
  for (let i = 0; i < 60; i++) {
    home += (rng() - 0.5) * 0.4; // < 0.5pp noise, well under minMovePp
    fired += d.push(tick(1, i, { Home: home, Away: 100 - home })).length;
  }
  assert.equal(fired, 0, "must not fire on sub-threshold noise");
});

test("fires exactly once on a genuine steam move (rising edge + hysteresis)", () => {
  const d = new SharpDetector(params);
  const signals = [];
  let home = 40;
  // warm up a calm baseline
  for (let i = 0; i < 20; i++) {
    home += 0.05;
    d.push(tick(2, i, { Home: home, Away: 100 - home }));
  }
  // steam: a big move drawn out over 4 ticks (+3pp each)
  for (let i = 20; i < 24; i++) {
    home += 3;
    signals.push(...d.push(tick(2, i, { Home: home, Away: 100 - home })));
  }
  // settle back to calm
  for (let i = 24; i < 40; i++) {
    home += 0.05;
    d.push(tick(2, i, { Home: home, Away: 100 - home }));
  }

  const homeSignals = signals.filter((s) => s.outcome === "Home");
  assert.equal(homeSignals.length, 1, "one steam move => one Home signal");
  const s = homeSignals[0]!;
  assert.equal(s.direction, "up");
  assert.ok(s.z >= params.zThreshold, `z ${s.z} should clear threshold`);
  assert.ok(Math.abs(s.movePp) >= params.minMovePp);
});

test("requires both z AND absolute-move gates", () => {
  const d = new SharpDetector(params);
  let home = 50;
  // ultra-calm baseline makes std tiny, so even a small move has huge z...
  for (let i = 0; i < 20; i++) {
    home += 0.001;
    d.push(tick(3, i, { Home: home, Away: 100 - home }));
  }
  // ...but a 0.5pp move is below minMovePp, so it must NOT fire despite high z.
  const fired = d.push(tick(3, 21, { Home: home + 0.5, Away: 100 - (home + 0.5) }));
  assert.equal(fired.length, 0, "high z but tiny absolute move must be suppressed");
});

// tiny deterministic PRNG for the test
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
