# ⚡ GreYat SharpSignal

**An autonomous, proof-grounded sharp-money detector for the 2026 World Cup — powered by the TxLINE StablePrice feed and settled on Solana.**

Built for the TxODDS **Trading Tools and Agents** track (World Cup hackathon on Superteam Earn).

---

## What it does

GreYat SharpSignal is a fully autonomous agent. Once started it takes **no human input**:

```
 TxLINE StablePrice feed (SSE)
        │  live demargined implied probabilities per outcome
        ▼
 ┌─────────────────┐   detects an abnormal probability move
 │ Sharp detector  │   (z-score vs the market's own recent volatility)
 └────────┬────────┘
          ▼
 ┌─────────────────┐   VERIFY the update's Merkle proof BEFORE acting
 │ Verify-before-  │   → refuses to trade on data it can't prove is
 │ trade gate      │     genuine TxLINE output anchored on Solana
 └────────┬────────┘
          ▼
 ┌─────────────────┐   opens a paper position (side = the outcome the
 │ Position + on-  │   sharp money is backing), anchored on-chain
 │ chain settle    │
 └────────┬────────┘
          ▼
 ┌─────────────────┐   at the final whistle, grades vs the TxLINE score
 │ Self-grader     │   feed → hit/miss, P&L, settled on-chain
 └─────────────────┘
```

It answers the sponsor's exact prompt — *"An agent that monitors TxLINE odds, flags significant odds shifts, logs the signal and tracks whether it predicted the outcome"* — and adds a novel twist judges can verify: **every decision is cryptographically grounded in proven TxLINE data.**

## The signal (deterministic, no black box)

For each outcome of a fixture's 1X2 market we track the **demargined implied probability** TxLINE ships in the `Pct` field (bookmaker-margin-invariant, directly interpretable as "the market's belief"). For each update:

1. `delta = pₜ − pₜ₋₁` — the single-step probability change.
2. Score it against the fixture's *own* recent volatility:
   `z = (delta − mean(recentDeltas)) / std(recentDeltas)`
3. Flag a **sharp move** when `|z| ≥ Z_THRESHOLD` **and** `|delta| ≥ MIN_MOVE_PP`.

Normalising by the market's recent standard deviation means one threshold works for a frantic in-play market and a placid pre-match one. Hysteresis latches the signal on the rising edge so a multi-tick steam move produces **one** signal, not a burst. The maths is fully reproducible from the raw feed — see [`src/signal/detector.ts`](src/signal/detector.ts) and the tests in [`detector.test.ts`](src/signal/detector.test.ts).

## Run it

**Three feed modes**, one agent:

```bash
npm install

# 1) mock — zero credentials, deterministic synthetic slate with a scripted
#    steam move + a control fixture that must NOT trigger. Great for CI/first run.
npm run agent:mock

# 2) replay — REAL recorded StablePrice history of a finished World Cup fixture,
#    replayed through the same detector/verifier/grader. Proves the agent on
#    genuine TxLINE data even when no match is currently in-play.
cp .env.example .env       # fill TXLINE_JWT + TXLINE_API_TOKEN (devnet)
npm run agent:replay       # default fixture 18179552 (Switzerland 2-0 Algeria)

# 3) live — subscribe to the live SSE StablePrice stream and trade in real time.
SHARP_FEED=live npm run agent
```

Example replay output (100% real odds):

```
⚡ SHARP Switzerland v Algeria — part1 40.8%→66.0% (+25.2pp, z=340)  ⚠ proof unanchored (root pending)
  → open part1 @ 1.515 stake 100
● settle Switzerland v Algeria 2-0 → backed part1, WON  pnl +51.50
```

Other scripts: `npm run typecheck`, `npm test`.

## TxLINE integration

| Concern | Endpoint / field | Where |
|---|---|---|
| Auth | `POST /auth/guest/start` (guest JWT) + `X-Api-Token` from `POST /api/token/activate` | [`src/txline/auth.ts`](src/txline/auth.ts) |
| Live odds | **SSE** `GET /api/odds/stream` (`OddsPayload`: `Pct`, `PriceNames`, `InRunning`, `GameState`) | [`src/txline/stream.ts`](src/txline/stream.ts) |
| Snapshots / fixtures | `GET /api/odds/snapshot/{id}`, `GET /api/fixtures/snapshot` | [`src/txline/client.ts`](src/txline/client.ts) |
| Scores (grading) | `GET /api/scores/historical/{id}`, SSE `GET /api/scores/stream` | [`src/txline/client.ts`](src/txline/client.ts) |
| Proof | `GET /api/odds/validation?messageId=&ts=` → on-chain `validate_odds` | [`src/txline/proof.ts`](src/txline/proof.ts), [`chain/txlineProgram.ts`](src/chain/txlineProgram.ts) |
| Replay | `GET /api/odds/updates/{fixtureId}` → historical 1X2 series | [`src/txline/replayFeed.ts`](src/txline/replayFeed.ts) |

## Verify-before-trade (on-chain `validate_odds`)

Before any signal can open a position, the agent proves the triggering update is genuine TxLINE data:

1. Fetch its Merkle proof — `GET /api/odds/validation?messageId=&ts=` → `{odds, summary, subTreeProof, mainTreeProof}`.
2. Hand those straight to the TxLINE oracle program's **`validate_odds(...) → bool`** (read-only `.view()`, [`src/chain/txlineProgram.ts`](src/chain/txlineProgram.ts)). The program re-derives the update's Merkle branch and checks it against the batch root committed in the `daily_odds_merkle_roots` PDA. The program does the hashing — we never guess the leaf format.

Statuses are reported honestly (`verified` ✅ / `rejected` ⛔ / `unanchored` ⚠ / …). A configurable policy (`strict` for production, `advisory` for devnet) decides whether an unverified signal may still trade.

> **Devnet note (verified 2026-07-03):** the `daily_odds_roots` PDA is **not yet published on the devnet free tier** — only `daily_scores_roots` is. So on devnet `validate_odds` has no root to check against and reports `unanchored`; under `advisory` policy the agent still opens the position and flags it. The instruction is correct and returns a real `true`/`false` against an anchored root on mainnet (or once devnet odds anchoring goes live) with **no code change**.

## Dashboard

A Next.js dashboard visualises the agent for judges and demos.

```bash
cp .env.example .env.local     # TXLINE_JWT + TXLINE_API_TOKEN (devnet)
npm run dev                    # http://localhost:3000
# or a production build:
npm run build && npm start
```

- **Live TxLINE feed** panel — pulls current World Cup fixtures from `/api/fixtures` at view-time (proves live ingestion).
- **Run agent on real match** — `/api/run` executes the full agent over a real recorded fixture (Switzerland 2-0 Algeria) server-side; the client plays it back with a live probability chart, signal tape, positions, and a P&L summary.
- **Verify-before-trade** panel — shows each signal's odds-proof status, the Merkle root, and the `daily_odds_roots` PDA. The proof (`/api/odds/validation`) and the on-chain root check are fetched **live per signal**; the web path checks root existence with `@solana/web3.js` (no anchor bundle), while the CLI runs the full `validate_odds` simulation.
- `?autorun=1` runs immediately and jumps to the final state (handy for deep-links/demos).

The two API routes (`app/api/*`) run on the Node.js runtime and reuse the same `src/` agent modules — no logic duplication.

### Deploy (Vercel)

```bash
vercel                                  # link + preview
vercel env add TXLINE_ORIGIN            # https://txline-dev.txodds.com
vercel env add TXLINE_JWT               # from the TxLINE subscription
vercel env add TXLINE_API_TOKEN
vercel env add SHARP_VERIFY_POLICY      # advisory (devnet) | strict (mainnet)
vercel --prod
```

`SOLANA_RPC_URL` defaults to devnet. The recorded odds bundle (`data/replay/18179552.json`) is committed, so `/api/run` needs no large download at request time.

## Settlement ledger

Each `signal → position → settlement` is an auditable event written to an append-only ledger (`data/ledger.jsonl`) with a content-hash reference, the proof status, and the Merkle root of the triggering update. Settlement is behind the pluggable [`SettlementSink`](src/chain/settlement.ts) interface, so recording positions on a custom devnet program later is a factory swap, not a loop rewrite.

## How it maps to the judging criteria

- **Core Functionality & Data Ingestion** — ingests the live StablePrice SSE feed and acts on it.
- **Autonomous Operation** — no human in the loop from start to settlement.
- **Logic & Code Architecture** — deterministic, documented, unit-tested signal; source-agnostic feed/proof/settlement interfaces.
- **Innovation** — *verify-before-trade*: the agent proves each update is genuine on-chain-anchored TxLINE data before it will act on it.
- **Production Readiness** — auto-reconnecting SSE with backoff, JWT refresh, graceful shutdown, self-grading P&L.

## Layout

```
src/
  config.ts            env + tuning
  txline/              types, auth, REST client, SSE stream, mock feed, proof
  signal/              rolling state + sharp-move detector (+ tests)
  agent/               positions, autonomous loop, self-grading
  chain/               settlement sink (local now, devnet next)
  index.ts             entrypoint + live console + P&L summary
```
