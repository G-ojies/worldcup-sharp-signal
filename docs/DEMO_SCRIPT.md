# GreYat SharpSignal — 5-minute demo script

**Live:** https://worldcup-sharp-signal.vercel.app · **Repo:** https://github.com/G-ojies/worldcup-sharp-signal

Goal: show a working autonomous agent that ingests TxLINE data, detects sharp moves, proves them on Solana, and grades itself. Judges weigh the demo heavily and matches may be over at review time — so we demo on a **real recorded match** plus the **live feed**.

---

### 0:00 — Hook (20s)
> "Sharp money moves the market before the crowd catches up. GreYat SharpSignal is an autonomous agent that watches the TxLINE World Cup odds, catches those steam moves the moment they happen, and — the part that matters for a trading desk — proves every move is real TxLINE data anchored on Solana before it acts on it."

Open the live dashboard. Point at the **Live TxLINE feed** panel (real fixtures loading) — "this is live TxLINE data, right now."

### 0:20 — The problem & the data (40s)
- Explain StablePrice: consensus, demargined implied probability per outcome.
- "The agent tracks that probability and asks a simple statistical question: is this move abnormal *relative to how much this market has been moving*?"

### 1:00 — Run the agent (90s)
- Click **Run agent on real match** (Switzerland v Algeria, a finished fixture — real recorded odds).
- As it plays: the **home line surges** toward 100% when goals go in. Signal cards pop with the probability jump, the **z-score**, and a proof badge.
- "Three sharp moves caught. Each one, before it opened a position, was checked against TxLINE's Merkle proof and its Solana batch root via `validate_odds`."
- Point at the **Verify-before-trade** panel: the odds root hash + the `daily_odds_roots` PDA. "On devnet the odds root isn't published yet, so it's honestly flagged 'root pending' — the same call returns a hard true/false on mainnet."

### 2:30 — Settlement & result (45s)
- Playback reaches the whistle. Positions flip to **WON**. Summary: 3 signals, 100% hit, **+98.40**, final 2–0.
- "It graded itself against the real final score from the TxLINE scores feed — no human in the loop from ingest to settlement."

### 3:15 — Under the hood (60s)
- Show the repo briefly: `src/signal/detector.ts` (the ~30-line deterministic signal + passing unit tests), `src/chain/txlineProgram.ts` (`validate_odds`), the three feed sources.
- Terminal: `npm run agent:replay` streaming the same run in the CLI — "same agent, no UI, fully autonomous. It also runs on the live SSE stream and a zero-credential mock."

### 4:15 — Close (30s)
- "Deterministic, documented, on-chain-verified, self-grading. A trading desk could point this at any TxLINE market. Repo and live link are in the description. Thanks."

---

**Recording tips**
- Use `https://worldcup-sharp-signal.vercel.app/?autorun=1` for a clean one-take that jumps straight to the finished run.
- Keep a terminal split for the `npm run agent:replay` moment (real, not staged).
- ≤ 5:00 total. Screen + voice. Confirm audio isn't muted before submitting.
