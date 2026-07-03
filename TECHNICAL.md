# GreYat SharpSignal — Technical Overview

**Live:** https://worldcup-sharp-signal.vercel.app · **Repo:** https://github.com/G-ojies/worldcup-sharp-signal

Autonomous sharp-money detector for the 2026 World Cup, built for the TxODDS **Trading Tools and Agents** track. It streams the TxLINE StablePrice feed, flags significant odds shifts, proves each update on Solana before acting, opens a paper position, and self-grades at the final whistle.

## Core idea

The sponsor's "Sharp Movement Detector" prompt, elevated with a **verify-before-trade** guarantee: the agent refuses to act on any odds update it can't prove is genuine, on-chain-anchored TxLINE data.

## The signal (deterministic)

For each 1X2 outcome we track TxLINE's demargined implied probability (`Pct` — bookmaker-margin-invariant). For each update:

1. `delta = pₜ − pₜ₋₁` (single-step probability change, percentage points).
2. Score it against the fixture's *own* recent volatility: `z = (delta − mean(recentΔ)) / std(recentΔ)`.
3. Flag a sharp move when `|z| ≥ 3` **and** `|delta| ≥ 1.5pp`.

Normalising by the market's own std makes one threshold work for placid pre-match and frantic in-play markets. Hysteresis latches on the rising edge → one steam move = one signal. Fully reproducible from the raw feed; unit-tested in `src/signal/detector.test.ts` (silent-on-noise, fires-once, requires-both-gates).

## Verify-before-trade (on-chain `validate_odds`)

1. Fetch the update's Merkle proof — `GET /api/odds/validation?messageId=&ts=` → `{odds, summary, subTreeProof, mainTreeProof}`.
2. Hand it to the TxLINE oracle program's **`validate_odds(ts, odds, summary, subTreeProof, mainTreeProof) → bool`** (read-only `.view()`, `src/chain/txlineProgram.ts`). The program re-derives the Merkle branch and checks it against the batch root committed in the `daily_odds_merkle_roots` PDA. The program owns the hashing — we never guess the leaf format.

The dashboard's serverless route uses a lighter check (`src/txline/proofLight.ts`): it fetches the real proof and verifies the `daily_odds_roots` PDA exists (via `@solana/web3.js`, no anchor bundle). Statuses: `verified` / `rejected` / `unanchored`, gated by a `strict` (mainnet) vs `advisory` (devnet) policy.

> **Devnet note:** odds Merkle roots are **not yet anchored on the devnet free tier** (only `daily_scores_roots` is — verified on-chain). So `validate_odds` reports `unanchored` on devnet; the instruction is correct and returns a real boolean against an anchored root on mainnet with no code change. See FEEDBACK.md.

## Grading

At the final whistle (`game_finalised` in the scores feed) the agent reads `Stats["1"]`/`Stats["2"]` (participant goals), maps to home/away via `Participant1IsHome`, decides the winning 1X2 outcome, and settles each position (win → `stake × (odds−1)`, loss → `−stake`).

## TxLINE endpoints used

| Purpose | Endpoint |
|---|---|
| Fixtures | `GET /api/fixtures/snapshot` |
| Live odds (SSE) | `GET /api/odds/stream` |
| Odds snapshot | `GET /api/odds/snapshot/{fixtureId}` |
| Historical odds (replay) | `GET /api/odds/updates/{fixtureId}` |
| Odds Merkle proof | `GET /api/odds/validation?messageId=&ts=` |
| Scores / final result | `GET /api/scores/snapshot/{fixtureId}` |
| Auth | `POST /auth/guest/start` + `X-Api-Token` |

Odds fields consumed: `SuperOddsType` (`1X2_PARTICIPANT_RESULT`, full match = `MarketPeriod` null), `PriceNames` (`part1`/`draw`/`part2`), `Pct`, `Prices`, `InRunning`, `Ts`, `MessageId`.

## Run it

```bash
npm install
npm run agent:mock        # zero-credential synthetic demo
cp .env.example .env      # add TXLINE_JWT + TXLINE_API_TOKEN
npm run agent:replay      # real recorded fixture through the agent
npm run dev               # dashboard at localhost:3000
```

## Architecture

```
src/txline/   types, auth, REST client, SSE stream, mock + replay feeds, proof (+light)
src/signal/   rolling state + z-score detector (+ tests)
src/agent/    positions, autonomous loop, self-grading
src/chain/    on-chain validate_odds caller, settlement sink
app/          Next.js dashboard (api/fixtures, api/run, page + chart)
```

Three feed sources (`mock` / `replay` / `live`) implement one `Feed` interface; the detector, verifier and settlement sink are all dependency-injected, so swapping sources or the verification backend is a one-line change.
