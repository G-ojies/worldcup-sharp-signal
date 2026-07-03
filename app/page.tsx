"use client";

/* ─────────────────────────────────────────────────────────────
 * DASHBOARD ENTRANCE STORYBOARD  (static shell never blanks)
 *
 *    0ms   header + Run button visible immediately (shell)
 *   80ms   pipeline "slides" strip springs in
 *  160ms   probability chart slides up
 *  240ms   right column (verify / positions / feed) slides from right
 *  320ms   signal tape slides up
 *  on run: signals & positions stagger in as the playhead reaches them;
 *          summary stat tiles count up when the whistle blows
 * ───────────────────────────────────────────────────────────── */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProbabilityChart } from "./components/ProbabilityChart";
import { PipelineStages } from "./components/PipelineStages";
import { AnimatedNumber, Reveal, SPRING } from "./components/motion";
import { outcomeLabel, type FixtureRow, type RunEvent, type RunResponse } from "./lib/types";

type RunState = "idle" | "loading" | "playing" | "done" | "error";

const TIMING = { pipeline: 0.08, chart: 0.16, aside: 0.24, tape: 0.32 };
const PLAYBACK_MS = 11_000;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function Page() {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runError, setRunError] = useState("");
  const [playIdx, setPlayIdx] = useState(0);
  const [instant, setInstant] = useState(false);
  const rafRef = useRef<number | null>(null);

  const startRun = useCallback(async () => {
    setRunState("loading");
    setRunError("");
    setRun(null);
    setPlayIdx(0);
    try {
      const res = await fetch("/api/run", { cache: "no-store" });
      if (!res.ok) throw new Error(`agent run failed (${res.status})`);
      setRun((await res.json()) as RunResponse);
      setRunState("playing");
    } catch (err) {
      setRunError((err as Error).message);
      setRunState("error");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("autorun")) {
      setInstant(true);
      void startRun();
    }
  }, [startRun]);

  useEffect(() => {
    if (runState !== "playing" || !run) return;
    const n = run.series.length;
    if (instant || prefersReducedMotion()) {
      setPlayIdx(n - 1);
      setRunState("done");
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const frac = Math.min(1, (now - start) / PLAYBACK_MS);
      setPlayIdx(Math.floor(frac * (n - 1)));
      if (frac < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setPlayIdx(n - 1);
        setRunState("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [runState, run, instant]);

  const playT = run && run.series.length ? run.series[Math.min(playIdx, run.series.length - 1)]!.t : 0;
  const atEnd = run ? playIdx >= run.series.length - 1 : false;
  const revealed = useMemo(() => (run ? run.events.filter((e) => atEnd || e.tsMs <= playT + 1) : []), [run, playT, atEnd]);
  const signals = useMemo(() => (run ? run.events.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal") : []), [run]);

  // pipeline stage from real run progress
  const anySignal = revealed.some((e) => e.type === "signal");
  const anySettle = revealed.some((e) => e.type === "settle");
  const stage =
    runState === "idle" || runState === "loading" || runState === "error"
      ? 0
      : anySettle || runState === "done"
        ? 4
        : anySignal
          ? 3
          : 1;

  const metrics = {
    signals: revealed.filter((e) => e.type === "signal").length,
    checked: revealed.filter((e) => e.type === "open").length,
    settled: revealed.filter((e) => e.type === "settle").length,
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto min-h-screen max-w-[1200px] px-4 py-6 sm:px-6 sm:py-9">
        <Header runState={runState} onRun={startRun} />

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.smooth, delay: TIMING.pipeline }} className="mt-6">
          <PipelineStages stage={stage} metrics={metrics} />
        </motion.section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Reveal show from="up" delay={TIMING.chart}>
              <ChartCard run={run} runState={runState} runError={runError} playIdx={playIdx} signals={signals} onRun={startRun} instant={instant} />
            </Reveal>
            <Reveal show from="up" delay={TIMING.tape}>
              <SignalTape run={run} revealed={revealed} />
            </Reveal>
          </div>

          <Reveal show from="right" delay={TIMING.aside} className="space-y-4">
            <VerifyPanel run={run} revealed={revealed} />
            <PositionsCard run={run} revealed={revealed} />
            <LiveFixtures />
          </Reveal>
        </div>

        <SummaryBar run={run} runState={runState} />
        <Footer />
      </main>
    </MotionConfig>
  );
}

/* ─────────────────────────── header ─────────────────────────── */
function Header({ runState, onRun }: { runState: RunState; onRun: () => void }) {
  const busy = runState === "loading" || runState === "playing";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <motion.span
            className="text-2xl leading-none"
            animate={{ scale: [1, 1.15, 1], filter: ["drop-shadow(0 0 0 transparent)", "drop-shadow(0 0 8px hsl(190 95% 55%))", "drop-shadow(0 0 0 transparent)"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            ⚡
          </motion.span>
          <h1 className="text-gradient-animated text-2xl font-bold tracking-tight">GreYat SharpSignal</h1>
          <span className="rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] text-accent">World Cup · TxLINE</span>
        </div>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
          Autonomous steam-move agent. Streams the TxLINE StablePrice feed, flags sharp odds shifts, proves each on Solana
          before acting, and grades itself at the final whistle.
        </p>
      </div>
      <motion.button
        type="button"
        onClick={onRun}
        disabled={busy}
        whileHover={{ scale: busy ? 1 : 1.03 }}
        whileTap={{ scale: busy ? 1 : 0.97 }}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-bg shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Spinner /> : <span aria-hidden>▶</span>}
        {runState === "idle" ? "Run agent on real match" : busy ? "Running…" : "Replay again"}
      </motion.button>
    </header>
  );
}

/* ─────────────────────────── chart card ─────────────────────────── */
function ChartCard({
  run,
  runState,
  runError,
  playIdx,
  signals,
  onRun,
  instant,
}: {
  run: RunResponse | null;
  runState: RunState;
  runError: string;
  playIdx: number;
  signals: Extract<RunEvent, { type: "signal" }>[];
  onRun: () => void;
  instant: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Implied probability</h2>
          {run && <span className="text-xs text-muted">{run.meta.home} v {run.meta.away} · {run.meta.competition}</span>}
        </div>
        <Legend />
      </div>
      {runState === "idle" && <EmptyState onRun={onRun} />}
      {runState === "loading" && <ChartSkeleton />}
      {runState === "error" && <ErrorState msg={runError} onRun={onRun} />}
      {run && (runState === "playing" || runState === "done") && (
        <ProbabilityChart series={run.series} playIdx={playIdx} signals={signals} meta={run.meta} instant={instant} />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted">
      <span className="flex items-center gap-1"><i className="h-0.5 w-3 rounded bg-accent" />home</span>
      <span className="flex items-center gap-1"><i className="h-0.5 w-3 rounded bg-border" />draw</span>
      <span className="flex items-center gap-1"><i className="h-0.5 w-3 rounded bg-muted" />away</span>
    </div>
  );
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
      <p className="max-w-sm text-sm text-muted">
        Replay a finished World Cup match — real recorded StablePrice odds streamed through the live agent, with every
        signal proof-checked on Solana in real time.
      </p>
      <motion.button
        type="button"
        onClick={onRun}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 text-sm text-accent"
      >
        <span aria-hidden>▶</span> Run the agent
      </motion.button>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-3">
      <div className="relative h-40 w-full overflow-hidden rounded-lg bg-panel-2">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/5 to-transparent" />
      </div>
      <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Running agent over real TxLINE odds…</p>
    </div>
  );
}

function ErrorState({ msg, onRun }: { msg: string; onRun: () => void }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-neg">Couldn’t run the agent.</p>
      <p className="max-w-sm text-xs text-muted">{msg}</p>
      <button type="button" onClick={onRun} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-panel-2">
        Retry
      </button>
    </div>
  );
}

/* ─────────────────────────── badges ─────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    verified: ["✓ on-chain verified", "text-pos border-pos/40 bg-pos/10"],
    rejected: ["✗ proof rejected", "text-neg border-neg/40 bg-neg/10"],
    unanchored: ["⚠ root pending", "text-warn border-warn/40 bg-warn/10"],
    unavailable: ["⚠ proof unavailable", "text-warn border-warn/40 bg-warn/10"],
    error: ["⚠ verify error", "text-warn border-warn/40 bg-warn/10"],
    mock: ["✓ verified", "text-pos border-pos/40 bg-pos/10"],
  };
  const [label, cls] = map[status] ?? [status, "text-muted border-border"];
  return <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function statusBar(status: string): string {
  if (status === "verified" || status === "mock") return "border-l-pos";
  if (status === "rejected") return "border-l-neg";
  return "border-l-warn";
}

/* ─────────────────────────── signal tape ─────────────────────────── */
function SignalTape({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  if (!run) return null;
  const sigs = revealed.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">Sharp-move signals</h2>
      {sigs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Watching the feed… no steam yet.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sigs.map((s, i) => (
              <motion.li
                key={`${s.tsMs}-${i}`}
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={SPRING.snappy}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-l-2 bg-panel-2 px-3 py-2.5 text-sm ${statusBar(s.proofStatus)}`}
              >
                <span className="font-semibold text-accent">{outcomeLabel(s.outcome, run.meta)}</span>
                <span className="tnum text-muted">{s.probBefore.toFixed(1)}% → {s.probAfter.toFixed(1)}%</span>
                <span className="tnum font-medium text-pos">+{s.movePp.toFixed(1)}pp</span>
                <span className="tnum text-muted">z={s.z.toFixed(1)}</span>
                <span className="ml-auto"><StatusBadge status={s.proofStatus} /></span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── verify panel ─────────────────────────── */
function VerifyPanel({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  const latest = [...revealed].reverse().find((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Verify-before-trade</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Every signal’s odds update is checked against TxLINE’s Merkle proof and its Solana batch root
        (<code className="text-fg">validate_odds</code>) before a position opens.
      </p>
      <AnimatePresence mode="wait">
        {!latest ? (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-xs text-muted">
            No proof checked yet.
          </motion.p>
        ) : (
          <motion.dl key={latest.tsMs} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.smooth} className="mt-4 space-y-2 text-xs">
            <Row k="status"><StatusBadge status={latest.proofStatus} /></Row>
            {latest.root && <Row k="odds root"><code className="tnum text-fg">{latest.root.slice(0, 20)}…</code></Row>}
            {latest.pda && <Row k="root PDA"><code className="tnum text-fg">{latest.pda.slice(0, 16)}…</code></Row>}
          </motion.dl>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ─────────────────────────── positions ─────────────────────────── */
function PositionsCard({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  if (!run) return null;
  const opens = revealed.filter((e): e is Extract<RunEvent, { type: "open" }> => e.type === "open");
  const settles = revealed.filter((e): e is Extract<RunEvent, { type: "settle" }> => e.type === "settle");
  const settleFor = (o: string) => settles.find((s) => s.outcome === o);

  return (
    <div className="card p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">Positions</h2>
      {opens.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No positions yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          <AnimatePresence initial={false}>
            {opens.map((o, i) => {
              const s = settleFor(o.outcome);
              return (
                <motion.li
                  key={`${o.tsMs}-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING.snappy}
                  className={`rounded-md border border-l-2 bg-panel-2 px-3 py-2 ${s ? (s.won ? "border-l-pos" : "border-l-neg") : "border-l-warn"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{outcomeLabel(o.outcome, run.meta)}</span>
                    <span className="tnum text-muted">@ {o.entryOdds.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="tnum text-muted">stake {o.stake}</span>
                    {s ? (
                      <span className={`tnum font-semibold ${s.won ? "text-pos" : "text-neg"}`}>
                        {s.won ? "WON" : "LOST"} {s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-warn">open</span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── live fixtures ─────────────────────────── */
function LiveFixtures() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [rows, setRows] = useState<FixtureRow[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/fixtures", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `fixtures ${res.status}`);
      setRows(data.fixtures.slice(0, 8));
      setState("ok");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <h2 className="text-sm font-semibold">Live TxLINE feed</h2>
      </div>
      {state === "loading" && <p className="py-3 text-center text-xs text-muted">Fetching live fixtures…</p>}
      {state === "error" && (
        <div className="text-center">
          <p className="text-xs text-neg">Live feed unavailable</p>
          <p className="mt-1 text-[11px] text-muted">{err}</p>
          <button type="button" onClick={load} className="mt-2 rounded border px-2 py-1 text-xs hover:bg-panel-2">Retry</button>
        </div>
      )}
      {state === "ok" && rows.length === 0 && <p className="py-3 text-center text-xs text-muted">No fixtures listed right now.</p>}
      {state === "ok" && rows.length > 0 && (
        <ul className="scroll-thin max-h-52 space-y-1 overflow-y-auto text-xs">
          {rows.map((f, i) => (
            <motion.li
              key={f.fixtureId}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING.smooth, delay: Math.min(i * 0.04, 0.3) }}
              className="flex items-center justify-between gap-2 rounded px-1 py-1"
            >
              <span className="truncate">{f.home} <span className="text-muted">v</span> {f.away}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${f.state === "started" ? "bg-pos/10 text-pos" : "text-muted"}`}>{f.state}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── summary tiles ─────────────────────────── */
function SummaryBar({ run, runState }: { run: RunResponse | null; runState: RunState }) {
  if (!run || runState !== "done") return null;
  const s = run.summary;
  const hit = s.settled ? Math.round((s.won / s.settled) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.bouncy}
      className="card glow-accent mt-4 grid grid-cols-2 gap-3 p-5 sm:grid-cols-4"
    >
      <Tile label="Signals" delay={0}>
        <AnimatedNumber value={s.signalsSeen} className="tnum text-3xl font-bold" delay={0.05} />
        <div className="tnum mt-0.5 text-[11px] text-muted">{s.signalsVerified} verified · {s.signalsAdvisory} advisory</div>
      </Tile>
      <Tile label="Hit rate" delay={0.1}>
        <AnimatedNumber value={hit} suffix="%" className="tnum text-3xl font-bold" delay={0.15} />
        <div className="tnum mt-0.5 text-[11px] text-muted">{s.won}/{s.settled} won</div>
      </Tile>
      <Tile label="Net P&L" delay={0.2}>
        <AnimatedNumber value={s.pnl} decimals={2} signed className={`tnum text-3xl font-bold ${s.pnl >= 0 ? "text-pos" : "text-neg"}`} delay={0.25} />
        <div className="tnum mt-0.5 text-[11px] text-muted">ROI {s.roi >= 0 ? "+" : ""}{s.roi}%</div>
      </Tile>
      <Tile label="Final" delay={0.3}>
        <span className="tnum text-3xl font-bold text-gradient">{run.meta.finalHome}–{run.meta.finalAway}</span>
        <div className="tnum mt-0.5 text-[11px] text-muted">{run.meta.home} v {run.meta.away}</div>
      </Tile>
    </motion.div>
  );
}

function Tile({ label, delay, children }: { label: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.smooth, delay }}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5">{children}</div>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span>Data: TxLINE StablePrice (TxODDS)</span>
      <span>·</span>
      <span>Verification: Solana <code>validate_odds</code> (devnet)</span>
      <span>·</span>
      <span>Odds are recorded real feed; live fixtures + proof checks are fetched live.</span>
    </footer>
  );
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}
