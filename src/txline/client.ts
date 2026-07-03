import { config } from "../config.js";
import { authHeaders, getGuestJwt } from "./auth.js";
import type { Fixture, OddsPayload, OddsValidation, ScoreUpdate } from "./types.js";

/**
 * Thin REST client over the TxLINE data endpoints.
 * All calls attach the guest JWT + API token and transparently retry once on a
 * 401 by refreshing the guest JWT (which is short-lived).
 */
async function get<T>(path: string): Promise<T> {
  const url = `${config.txline.origin}${path}`;

  const attempt = async (): Promise<Response> =>
    fetch(url, { headers: await authHeaders({ Accept: "application/json" }) });

  let res = await attempt();
  if (res.status === 401) {
    await getGuestJwt(true); // refresh and retry once
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Latest fixture snapshots, optionally filtered by competition id (World Cup). */
export async function getFixtures(params?: { competitionId?: number; date?: string }): Promise<Fixture[]> {
  const q = new URLSearchParams();
  if (params?.competitionId !== undefined) q.set("competitionId", String(params.competitionId));
  if (params?.date) q.set("date", params.date);
  const qs = q.toString();
  return get<Fixture[]>(`/api/fixtures/snapshot${qs ? `?${qs}` : ""}`);
}

/** Latest odds snapshot for a fixture (all markets/bookmakers currently priced). */
export function getOddsSnapshot(fixtureId: number): Promise<OddsPayload[]> {
  return get<OddsPayload[]>(`/api/odds/snapshot/${fixtureId}`);
}

/**
 * All cached odds updates for a fixture (the current in-memory window — in
 * practice the full available history for a recent fixture; the replay feed
 * filters this to the full-match 1X2 series).
 */
export function getOddsUpdates(fixtureId: number): Promise<OddsPayload[]> {
  return get<OddsPayload[]>(`/api/odds/updates/${fixtureId}`);
}

/** Merkle proof for a single odds update — inputs to the on-chain validate_odds. */
export function getOddsValidation(messageId: string, ts: number): Promise<OddsValidation> {
  const q = new URLSearchParams({ messageId, ts: String(ts) });
  return get<OddsValidation>(`/api/odds/validation?${q}`);
}

/** Latest score updates for a fixture (raw wire shape with Stats/Action/Seq). */
export function getScoresSnapshot(fixtureId: number): Promise<ScoreUpdate[]> {
  return get<ScoreUpdate[]>(`/api/scores/snapshot/${fixtureId}`);
}

/**
 * Resolve a fixture's final goals from the scores feed.
 * Uses the game_finalised action's Stats ("1"=P1 goals, "2"=P2 goals), mapped to
 * home/away via Participant1IsHome. Returns null if no finalised stat is present.
 */
export async function getFinalGoals(
  fixtureId: number,
  participant1IsHome: boolean,
): Promise<{ home: number; away: number } | null> {
  const updates = await getScoresSnapshot(fixtureId).catch(() => [] as ScoreUpdate[]);
  const finalUpdate =
    [...updates].reverse().find((u) => u.Action === "game_finalised" && u.Stats) ??
    [...updates].sort((a, b) => (b.Seq ?? 0) - (a.Seq ?? 0)).find((u) => u.Stats);
  if (!finalUpdate?.Stats) return null;
  const p1 = Number(finalUpdate.Stats["1"] ?? 0);
  const p2 = Number(finalUpdate.Stats["2"] ?? 0);
  return participant1IsHome ? { home: p1, away: p2 } : { home: p2, away: p1 };
}
