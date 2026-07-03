import { config } from "../config.js";
import { authHeaders, getGuestJwt } from "./auth.js";
import { toPriceTick } from "./normalize.js";
import type { OddsPayload, PriceTick } from "./types.js";

/** One parsed SSE frame. */
interface SseFrame {
  id?: string;
  event?: string;
  data?: string;
  retry?: number;
}

/**
 * Parse a single SSE block (fields separated by newlines, blocks by a blank line).
 * Multi-line `data:` fields are concatenated with "\n" per the SSE spec.
 */
export function parseSseBlock(block: string): SseFrame {
  const frame: SseFrame = {};
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue; // blank or comment
    const idx = line.indexOf(":");
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? "" : line.slice(idx + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "id":
        frame.id = value;
        break;
      case "event":
        frame.event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "retry":
        frame.retry = Number(value);
        break;
    }
  }
  if (dataLines.length) frame.data = dataLines.join("\n");
  return frame;
}

/**
 * Connect to an SSE endpoint and yield decoded JSON `data` payloads of type T.
 * Auto-reconnects with backoff on network drops; refreshes the guest JWT on 401.
 */
async function* sseJson<T>(path: string, signal?: AbortSignal): AsyncGenerator<T> {
  const url = `${config.txline.origin}${path}`;
  let backoffMs = 1000;

  while (!signal?.aborted) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: await authHeaders({ Accept: "text/event-stream", "Cache-Control": "no-cache" }),
        signal: signal ?? null,
      });
    } catch (err) {
      if (signal?.aborted) return;
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
      continue;
    }

    if (res.status === 401) {
      await getGuestJwt(true);
      continue;
    }
    if (!res.ok || !res.body) {
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
      continue;
    }

    backoffMs = 1000; // healthy connection resets backoff
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        // SSE frames are delimited by a blank line ("\n\n").
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const frame = parseSseBlock(block);
          if (!frame.data) continue;
          try {
            yield JSON.parse(frame.data) as T;
          } catch {
            // ignore keep-alives / malformed frames
          }
        }
      }
    } catch {
      // stream error -> fall through to reconnect
    } finally {
      reader.releaseLock();
    }
    // stream ended; loop reconnects unless aborted
  }
}

/**
 * The consensus full-match match-winner market on the live feed.
 * Confirmed from live devnet payloads: SuperOddsType "1X2_PARTICIPANT_RESULT"
 * with MarketPeriod null is the full-time 1X2 (MarketPeriod "half=1" is the
 * first-half market). Bookmaker is "TXLineStablePriceDemargined". We track ONE
 * market per fixture so the per-outcome probability series stays coherent — mixing
 * in the first-half / handicap / over-under markets would corrupt the detector.
 */
const FULL_MATCH_1X2 = "1X2_PARTICIPANT_RESULT";

function isFullMatch1x2(p: OddsPayload): boolean {
  return (
    p.SuperOddsType === FULL_MATCH_1X2 &&
    (p.MarketPeriod === null || p.MarketPeriod === undefined || p.MarketPeriod === "")
  );
}

/** Live StablePrice odds as normalized PriceTicks, filtered to the full-match 1X2 market. */
export async function* liveFeed(signal?: AbortSignal): AsyncGenerator<PriceTick> {
  for await (const payload of sseJson<OddsPayload>("/api/odds/stream", signal)) {
    if (!isFullMatch1x2(payload)) continue;
    const tick = toPriceTick(payload);
    if (tick) yield tick;
  }
}

/** Raw live score stream (used by the grader in live mode). */
export function scoreStream(signal?: AbortSignal) {
  return sseJson<import("./types.js").Scores>("/api/scores/stream", signal);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
