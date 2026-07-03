# Superteam Earn — Submission answers

Track: **Trading Tools and Agents** (TxODDS, World Cup) · https://superteam.fun/earn/listing/trading-tools-and-agents/
Close: **2026-07-19 23:59 UTC**

---

**Project name:** GreYat SharpSignal

**One-liner:** An autonomous, proof-grounded sharp-money detector for the World Cup — it streams the TxLINE StablePrice feed, flags steam moves with a deterministic z-score signal, proves each update on Solana via `validate_odds` before acting, and self-grades against the final score.

**Live application link:** https://worldcup-sharp-signal.vercel.app
- Click **Run agent on real match** to watch the agent work on a real recorded fixture.
- `/api/fixtures` shows live World Cup fixtures ingested at view-time.
- `/api/run` runs the full agent server-side (real proof checks per signal).

**Public repo:** https://github.com/G-ojies/worldcup-sharp-signal

**Demo video:** https://youtu.be/SxCgfMbxdoE

**Brief technical documentation:** see `TECHNICAL.md` (architecture, signal math, on-chain verification, endpoints).

**TxLINE endpoints used:**
`/auth/guest/start`, `/api/fixtures/snapshot`, `/api/odds/stream` (SSE), `/api/odds/snapshot/{id}`, `/api/odds/updates/{id}`, `/api/odds/validation?messageId=&ts=`, `/api/scores/snapshot/{id}`. On-chain: `validate_odds` against `daily_odds_merkle_roots`.

**Feedback on the TxLINE API:** see `FEEDBACK.md`. Short version — demargined `Pct` is excellent and made the whole signal margin-invariant; the on-chain proof model is genuinely novel. Main friction: **odds Merkle roots aren't anchored on devnet** (only scores are), so the odds proof path can't return `true` on the free tier; `/api/odds/validation` requires both `messageId` and `ts` (404s otherwise); `GameState` is unreliable (we use `InRunning` + `game_finalised` instead).

---

## How it meets the judging criteria

- **Core Functionality & Data Ingestion** — ingests live TxLINE StablePrice (SSE) and recorded feeds; acts on them autonomously.
- **Autonomous Operation** — no human input from ingest → detection → proof → position → settlement.
- **Logic & Code Architecture** — deterministic, documented, unit-tested z-score signal; dependency-injected feed/proof/settlement interfaces.
- **Innovation** — *verify-before-trade*: proves each update is genuine on-chain-anchored TxLINE data before acting.
- **Production Readiness** — auto-reconnecting SSE with backoff, JWT refresh, graceful shutdown, self-grading P&L, deployed dashboard.

## Eligibility checklist

- [x] Running agent/tool (live + devnet)
- [x] Integrates TxLINE data as a live input
- [x] Public GitHub repo
- [x] Working deployed link
- [x] Brief technical documentation
- [x] API feedback
- [x] Demo video (≤5 min) — https://youtu.be/SxCgfMbxdoE
