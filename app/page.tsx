"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProbabilityChart } from "./components/ProbabilityChart";
import { outcomeLabel, type FixtureRow, type RunEvent, type RunResponse } from "./lib/types";

type RunState = "idle" | "loading" | "playing" | "done" | "error";

const PLAYBACK_MS = 11_000;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function Page() {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runError, setRunError] = useState<string>("");
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
      const data = (await res.json()) as RunResponse;
      setRun(data);
      setRunState("playing");
    } catch (err) {
      setRunError((err as Error).message);
      setRunState("error");
    }
  }, []);

  // Optional ?autorun — run immediately (and jump straight to the final state).
  // Handy for demo capture and deep-links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("autorun")) {
      setInstant(true);
      void startRun();
    }
  }, [startRun]);

  // Playback: advance the playhead across the series over PLAYBACK_MS.
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
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlayIdx(n - 1);
        setRunState("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [runState, run]);

  const playT = run && run.series.length ? run.series[Math.min(playIdx, run.series.length - 1)]!.t : 0;
  const revealed = useMemo(() => (run ? run.events.filter((e) => e.tsMs <= playT + 1) : []), [run, playT]);
  const signals = useMemo(() => (run ? run.events.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal") : []), [run]);

  return (
    <main className="min-h-screen mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-10">
      <Header runState={runState} onRun={startRun} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* main column */}
        <section className="lg:col-span-2 space-y-4">
          <ChartCard run={run} runState={runState} runError={runError} playIdx={playIdx} signals={signals} onRun={startRun} />
          <SignalTape run={run} revealed={revealed} />
        </section>

        {/* side column */}
        <aside className="space-y-4">
          <VerifyPanel run={run} revealed={revealed} />
          <PositionsCard run={run} revealed={revealed} />
          <LiveFixtures />
        </aside>
      </div>

      <SummaryBar run={run} runState={runState} />
      <Footer />
    </main>
  );
}

/* ─────────────────────────── header ─────────────────────────── */
function Header({ runState, onRun }: { runState: RunState; onRun: () => void }) {
  const busy = runState === "loading" || runState === "playing";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-accent text-xl leading-none">⚡</span>
          <h1 className="text-xl font-semibold tracking-tight">SharpSignal</h1>
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted">World Cup · TxLINE</span>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Autonomous steam-move agent. Streams the TxLINE StablePrice feed, flags sharp odds shifts, proves each on Solana
          before acting, and grades itself at the final whistle.
        </p>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Spinner /> : <span aria-hidden>▶</span>}
        {runState === "idle" ? "Run agent on real match" : busy ? "Running…" : "Replay again"}
      </button>
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
}: {
  run: RunResponse | null;
  runState: RunState;
  runError: string;
  playIdx: number;
  signals: Extract<RunEvent, { type: "signal" }>[];
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Implied probability</h2>
          {run && <span className="text-xs text-muted">{run.meta.home} v {run.meta.away} · {run.meta.competition}</span>}
        </div>
        <Legend />
      </div>

      {runState === "idle" && <EmptyState onRun={onRun} />}
      {runState === "loading" && <ChartSkeleton label="Running agent over real TxLINE odds…" />}
      {runState === "error" && <ErrorState msg={runError} onRun={onRun} />}
      {run && (runState === "playing" || runState === "done") && (
        <ProbabilityChart series={run.series} playIdx={playIdx} signals={signals} meta={run.meta} />
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
      <button
        type="button"
        onClick={onRun}
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-panel-2"
      >
        <span aria-hidden>▶</span> Run the agent
      </button>
    </div>
  );
}

function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-3">
      <div className="h-32 w-full animate-pulse rounded bg-panel-2" />
      <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> {label}</p>
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

/* ─────────────────────────── signal tape ─────────────────────────── */
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
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function SignalTape({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  if (!run) return null;
  const sigs = revealed.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="rounded-lg border bg-panel p-4">
      <h2 className="mb-3 text-sm font-medium">Sharp-move signals</h2>
      {sigs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Watching the feed… no steam yet.</p>
      ) : (
        <ul className="space-y-2">
          {sigs.map((s, i) => (
            <li key={i} className="animate-slide-in flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-panel-2 px-3 py-2 text-sm">
              <span className="font-medium text-accent">{outcomeLabel(s.outcome, run.meta)}</span>
              <span className="tnum text-muted">
                {s.probBefore.toFixed(1)}% → {s.probAfter.toFixed(1)}%
              </span>
              <span className="tnum text-pos">+{s.movePp.toFixed(1)}pp</span>
              <span className="tnum text-muted">z={s.z.toFixed(1)}</span>
              <span className="ml-auto"><StatusBadge status={s.proofStatus} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── verify panel ─────────────────────────── */
function VerifyPanel({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  const latest = [...revealed].reverse().find((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="rounded-lg border bg-panel p-4">
      <h2 className="text-sm font-medium">Verify-before-trade</h2>
      <p className="mt-1 text-xs text-muted">
        Every signal’s odds update is checked against TxLINE’s Merkle proof and its Solana batch root
        (<code className="text-fg">validate_odds</code>) before a position opens.
      </p>
      {!latest ? (
        <p className="mt-4 text-xs text-muted">No proof checked yet.</p>
      ) : (
        <dl className="mt-4 space-y-2 text-xs">
          <Row k="status"><StatusBadge status={latest.proofStatus} /></Row>
          {latest.root && <Row k="odds root"><code className="tnum text-fg">{latest.root.slice(0, 20)}…</code></Row>}
          {latest.pda && <Row k="root PDA"><code className="tnum text-fg">{latest.pda.slice(0, 16)}…</code></Row>}
        </dl>
      )}
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
  const settleFor = (outcome: string) => settles.find((s) => s.outcome === outcome);

  return (
    <div className="rounded-lg border bg-panel p-4">
      <h2 className="mb-3 text-sm font-medium">Positions</h2>
      {opens.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No positions yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {opens.map((o, i) => {
            const s = settleFor(o.outcome);
            return (
              <li key={i} className="animate-slide-in rounded-md border bg-panel-2 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{outcomeLabel(o.outcome, run.meta)}</span>
                  <span className="tnum text-muted">@ {o.entryOdds.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="tnum text-muted">stake {o.stake}</span>
                  {s ? (
                    <span className={`tnum font-medium ${s.won ? "text-pos" : "text-neg"}`}>
                      {s.won ? "WON" : "LOST"} {s.pnl >= 0 ? "+" : ""}
                      {s.pnl.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-warn">open</span>
                  )}
                </div>
              </li>
            );
          })}
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
    <div className="rounded-lg border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <h2 className="text-sm font-medium">Live TxLINE feed</h2>
      </div>
      {state === "loading" && <p className="py-3 text-center text-xs text-muted">Fetching live fixtures…</p>}
      {state === "error" && (
        <div className="text-center">
          <p className="text-xs text-neg">Live feed unavailable</p>
          <p className="mt-1 text-[11px] text-muted">{err}</p>
          <button type="button" onClick={load} className="mt-2 rounded border px-2 py-1 text-xs hover:bg-panel-2">
            Retry
          </button>
        </div>
      )}
      {state === "ok" && rows.length === 0 && <p className="py-3 text-center text-xs text-muted">No fixtures listed right now.</p>}
      {state === "ok" && rows.length > 0 && (
        <ul className="scroll-thin max-h-52 space-y-1 overflow-y-auto text-xs">
          {rows.map((f) => (
            <li key={f.fixtureId} className="flex items-center justify-between gap-2 rounded px-1 py-1">
              <span className="truncate">
                {f.home} <span className="text-muted">v</span> {f.away}
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${f.state === "started" ? "bg-pos/10 text-pos" : "text-muted"}`}>
                {f.state}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── summary + footer ─────────────────────────── */
function SummaryBar({ run, runState }: { run: RunResponse | null; runState: RunState }) {
  if (!run || runState !== "done") return null;
  const s = run.summary;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-panel p-4 sm:grid-cols-4">
      <Stat label="Signals" value={`${s.signalsSeen}`} sub={`${s.signalsVerified} verified · ${s.signalsAdvisory} advisory`} />
      <Stat label="Hit rate" value={`${s.settled ? Math.round((s.won / s.settled) * 100) : 0}%`} sub={`${s.won}/${s.settled} won`} />
      <Stat label="Net P&L" value={`${s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}`} tone={s.pnl >= 0 ? "pos" : "neg"} sub={`ROI ${s.roi >= 0 ? "+" : ""}${s.roi}%`} />
      <Stat label="Final" value={`${run.meta.finalHome}–${run.meta.finalAway}`} sub={`${run.meta.home} v ${run.meta.away}`} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`tnum mt-0.5 text-2xl font-semibold ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : ""}`}>{value}</div>
      {sub && <div className="tnum mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
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
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}
