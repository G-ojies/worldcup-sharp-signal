# GreYat SharpSignal — demo video script (word-for-word)

**Target: 4:30** (hard cap 5:00) · screen recording + voiceover · **audio on, confirm before submitting.**

- **Live:** https://worldcup-sharp-signal.vercel.app/?autorun=1
- **Repo:** https://github.com/G-ojies/worldcup-sharp-signal
- Two windows ready: (1) browser on the dashboard, (2) terminal in the repo.
- Do a silent dry run once so the page is warm (fixtures + first `/api/run` cached).

Read the **VOICEOVER** column aloud. The **SCREEN** column is what you do. Times are cumulative.

---

### 0:00–0:25 · Hook
**SCREEN:** Dashboard open at the top, not yet run. Slowly move the cursor to the *Live TxLINE feed* panel.

**VOICEOVER:**
> "In betting markets, the sharp money moves the line before the crowd knows why. This is GreYat SharpSignal — an autonomous agent that watches the World Cup odds on TxLINE, catches those sharp moves the instant they happen, and — the part a trading desk actually cares about — proves every move is real, on-chain-anchored data *before* it acts on it. Everything you're seeing here is the live TxLINE feed, right now."

---

### 0:25–1:00 · The data & the idea
**SCREEN:** Hover the "Verify-before-trade" panel, then the header subtitle.

**VOICEOVER:**
> "TxLINE gives us StablePrice — consensus odds, already stripped of bookmaker margin, as a clean implied probability for each outcome. So instead of guessing, the agent asks one statistical question on every update: is this probability move abnormal *relative to how much this specific market has been moving?* That's a z-score against the market's own recent volatility. Big enough, and it's a steam move. That's the whole signal — deterministic, and about thirty lines of code."

---

### 1:00–2:20 · Run it on a real match
**SCREEN:** Click **Run agent on real match**. Let the chart animate. As each signal card appears, cursor-point at it.

**VOICEOVER:**
> "Let's run it on a real, finished World Cup match — Switzerland against Algeria — replaying the genuine recorded odds through the live agent.
>
> Watch the home line. As the goals go in, the market reprices hard — and the agent catches it. First steam move: Switzerland from forty-one to sixty-six percent in one step — a z-score of three hundred and forty. There's the second. And a third as the game's put to bed.
>
> But here's the important bit — look at each signal's badge, and the Verify-before-trade panel. Before the agent opened *any* position, it pulled that odds update's Merkle proof from TxLINE and checked it against its batch root on Solana, through the on-chain `validate_odds` instruction. If it can't prove the data is genuine, it doesn't trade. On devnet the odds root isn't published yet, so it's honestly flagged 'root pending' — and the exact same call returns a hard true-or-false against the anchored root on mainnet, no code change."

---

### 2:20–3:05 · Settlement & result
**SCREEN:** Playback finishes. Point at Positions flipping to **WON**, then the summary bar.

**VOICEOVER:**
> "The match ends, and the agent grades itself — pulling the final score straight from the TxLINE scores feed. All three positions backed Switzerland; all three win. Three signals, a hundred percent hit rate, plus ninety-eight units, thirty-three percent return — on the real two-nil result. No human touched anything from ingest to settlement."

---

### 3:05–4:05 · It's a real working system
**SCREEN:** Switch to the terminal. Run `npm run agent:replay`. Let a couple of signals scroll. Then quickly open `src/signal/detector.ts` and `src/chain/txlineProgram.ts`.

**VOICEOVER:**
> "And it's not just a dashboard. Here's the same agent in the terminal — same detection, same on-chain proof, same self-grading, no UI. It runs on the live TxLINE stream, on recorded matches, and on a zero-credential mock for testing.
>
> The signal logic is right here — plain, documented, and unit-tested for the cases that matter: stays silent on noise, fires once per move, and needs both a big z-score and a real percentage-point shift. And the verification is a direct call into TxLINE's own on-chain program — so we never guess how the data is hashed; the program tells us if it's real."

---

### 4:05–4:30 · Close
**SCREEN:** Back to the dashboard summary. Cursor rests on the live link / repo.

**VOICEOVER:**
> "So: an autonomous agent that turns the TxLINE feed into a proof-checked trading signal, and grades its own calls. Deterministic, on-chain-verified, and production-shaped — point it at any TxLINE market. The live app and the code are linked below. Thanks for watching."

---

**Post-record checklist**
- [ ] Under 5:00
- [ ] Voice audible the whole way (extract a frame + listen back before uploading)
- [ ] The three signal cards, the WON positions, and the `validate_odds` panel are all clearly visible on screen at some point
- [ ] The terminal `npm run agent:replay` moment is real (not staged)
- [ ] Upload unlisted/public (Loom or YouTube) → paste link into `docs/SUBMISSION.md`
