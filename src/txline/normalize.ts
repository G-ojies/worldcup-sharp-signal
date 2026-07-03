import type { OddsPayload, PriceTick } from "./types.js";

/**
 * Convert a raw TxLINE OddsPayload into the agent's internal PriceTick.
 *
 * TxLINE ships demargined implied probabilities in `Pct` as fixed 3-decimal
 * strings ("52.632"), aligned index-for-index with `PriceNames`. Quarter-handicap
 * legs carry "NA" and are skipped. We key probabilities by outcome label so the
 * detector never has to reason about array ordering.
 *
 * Returns null when a payload carries no usable probabilities (e.g. a suspended
 * market, or a market with no Pct block) — the caller should simply skip it.
 */
export function toPriceTick(p: OddsPayload): PriceTick | null {
  const names = p.PriceNames ?? [];
  const pct = p.Pct ?? [];
  if (names.length === 0 || pct.length === 0) return null;

  const probs: Record<string, number> = {};
  const n = Math.min(names.length, pct.length);
  for (let i = 0; i < n; i++) {
    const label = names[i];
    const raw = pct[i];
    if (label === undefined || raw === undefined || raw === "NA") continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    probs[label] = v;
  }

  if (Object.keys(probs).length === 0) return null;

  return {
    fixtureId: p.FixtureId,
    messageId: p.MessageId,
    tsMs: p.Ts,
    market: p.SuperOddsType,
    inRunning: p.InRunning,
    gameState: p.GameState,
    probs,
    raw: p,
  };
}
