import { config } from "../config.js";

/**
 * TxLINE dual-token auth.
 *
 *   1. POST /auth/guest/start           -> short-lived guest JWT
 *   2. (on-chain) subscribe to a tier   -> done once, off this code path
 *   3. POST /api/token/activate         -> long-lived X-Api-Token
 *
 * Step 3 is performed during the access milestone (it requires signing a Solana
 * subscription tx); the resulting token is pinned in .env as TXLINE_API_TOKEN.
 * At runtime we only need to (a) ensure we have a guest JWT and (b) attach both
 * credentials to every data request.
 */

let cachedJwt: string | null = config.txline.jwt || null;

/** Fetch a fresh guest JWT. Cached for the process lifetime; call refresh=true to renew. */
export async function getGuestJwt(refresh = false): Promise<string> {
  if (cachedJwt && !refresh) return cachedJwt;

  const url = `${config.txline.origin}/auth/guest/start`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`guest/start failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { token?: string; jwt?: string };
  const token = body.token ?? body.jwt;
  if (!token) {
    throw new Error("guest/start returned no token field");
  }
  cachedJwt = token;
  return token;
}

/** Headers required on every authenticated TxLINE data request. */
export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const jwt = await getGuestJwt();
  if (!config.txline.apiToken) {
    throw new Error("Missing TXLINE_API_TOKEN — activate the World Cup tier first.");
  }
  return {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": config.txline.apiToken,
    ...extra,
  };
}
