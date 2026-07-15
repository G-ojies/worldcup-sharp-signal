"use client";

/* ─────────────────────────────────────────────────────────────
 * DASHBOARD ENTRANCE STORYBOARD  (static shell never blanks)
 *
 *    0ms   masthead + hero visible immediately (shell)
 *   80ms   pipeline "slides" strip springs in
 *  160ms   probability chart slides up
 *  240ms   right column (verify / positions / feed) slides from right
 *  320ms   signal tape slides up
 *  on run: signals & positions stagger in as the playhead reaches them;
 *          the hero stat row counts up live as the run plays
 * ───────────────────────────────────────────────────────────── */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowUpRight, Check, Loader2, Play, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ProbabilityChart } from "./components/ProbabilityChart";
import { PipelineStages } from "./components/PipelineStages";
import { AnimatedNumber, Reveal, SPRING } from "./components/motion";
import { outcomeLabel, type FixtureRow, type RunEvent, type RunResponse } from "./lib/types";

type RunState = "idle" | "loading" | "playing" | "done" | "error";

const TIMING = { pipeline: 0.08, chart: 0.16, aside: 0.24, tape: 0.32 };
const PLAYBACK_MS = 11_000;
const REPO_URL = "https://github.com/G-ojies/worldcup-sharp-signal";

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

  /* Hero stats track the playhead rather than the final summary, so the numbers
   * fill in as the match replays. At the whistle they equal run.summary. */
  const live = useMemo(() => {
    const sigs = revealed.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
    const settles = revealed.filter((e): e is Extract<RunEvent, { type: "settle" }> => e.type === "settle");
    const won = settles.filter((s) => s.won).length;
    return {
      signals: sigs.length,
      verified: sigs.filter((s) => s.verified).length,
      opened: revealed.filter((e) => e.type === "open").length,
      settled: settles.length,
      won,
      pnl: settles.reduce((a, s) => a + s.pnl, 0),
      hit: settles.length ? Math.round((won / settles.length) * 100) : 0,
    };
  }, [revealed]);

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

  return (
    <MotionConfig reducedMotion="user">
      <Masthead />
      <main className="mx-auto min-h-screen max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <PageIntro runState={runState} onRun={startRun} />

        <div className="mt-8">
          <HeroBanner run={run} runState={runState} live={live} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: TIMING.pipeline }}
          className="mt-10"
        >
          <SectionHead title="Agent pipeline" meta="Four stages" />
          <PipelineStages stage={stage} metrics={{ signals: live.signals, checked: live.opened, settled: live.settled }} />
        </motion.section>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Reveal show from="up" delay={TIMING.chart}>
              <ChartCard run={run} runState={runState} runError={runError} playIdx={playIdx} signals={signals} onRun={startRun} instant={instant} />
            </Reveal>
            <Reveal show from="up" delay={TIMING.tape}>
              <SignalTape run={run} revealed={revealed} />
            </Reveal>
          </div>

          <Reveal show from="right" delay={TIMING.aside} className="space-y-4">
            <VerifyPanel revealed={revealed} />
            <PositionsCard run={run} revealed={revealed} />
            <LiveFixtures />
          </Reveal>
        </div>

        <Footer />
      </main>
    </MotionConfig>
  );
}

/* ─────────────────────────── masthead ─────────────────────────── */
function Diamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 1.5 22.5 12 12 22.5 1.5 12 12 1.5Zm0 5.4L6.9 12l5.1 5.1L17.1 12 12 6.9Z" />
    </svg>
  );
}

function Masthead() {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Diamond className="h-6 w-6 text-fg" />
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight">SharpSignal</div>
            <div className="label mt-1 text-[9px]">GreYat Labs</div>
          </div>
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg transition-[opacity,transform] duration-100 ease-out hover:opacity-90 active:translate-y-px"
        >
          View source
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────── page intro ─────────────────────────── */
function PageIntro({ runState, onRun }: { runState: RunState; onRun: () => void }) {
  const busy = runState === "loading" || runState === "playing";
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" aria-hidden />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="label">Live agent</span>
        </div>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">SharpSignal</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Autonomous steam-move agent. Streams the TxLINE StablePrice feed, flags sharp odds shifts, proves each on
          Solana before acting, and grades itself at the final whistle.
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 sm:items-end">
        <a
          href={`${REPO_URL}#how-it-works`}
          target="_blank"
          rel="noreferrer"
          className="label inline-flex items-center gap-1.5 transition-colors duration-100 ease-out hover:text-fg"
        >
          How it works
          <span aria-hidden>→</span>
        </a>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-cream px-5 text-sm font-medium text-bg transition-[opacity,transform] duration-100 ease-out hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
          {runState === "idle" ? "Run agent on real match" : busy ? "Running…" : "Replay again"}
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────── hero banner ─────────────────────────── */
type Live = {
  signals: number;
  verified: number;
  opened: number;
  settled: number;
  won: number;
  pnl: number;
  hit: number;
};

function HeroBanner({ run, runState, live }: { run: RunResponse | null; runState: RunState; live: Live }) {
  const started = runState === "playing" || runState === "done";
  const done = runState === "done";

  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-panel">
      {/* Layer order: photo → violet wash → scrim. The scrim is what guarantees
       * the heading clears AA over a bright, busy floodlit crowd. */}
      <Image
        src="/hero-stadium.jpg"
        alt=""
        fill
        priority
        sizes="(max-width: 1200px) 100vw, 1136px"
        className="pointer-events-none select-none object-cover object-[70%_center] opacity-75"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,hsl(var(--accent)/0.34),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,hsl(var(--panel))_24%,hsl(var(--panel)/0.82)_54%,hsl(var(--panel)/0.42))]"
      />
      {/* Vertical scrim: the stat row's 10px muted labels measured 3.0:1 against
       * the floodlit crowd (needs 4.5). This lands them on near-solid panel and
       * incidentally mutes the busiest, noisiest part of the photo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--panel))_20%,hsl(var(--panel)/0.72)_40%,transparent_72%)]"
      />

      <div className="relative p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Diamond className="h-5 w-5 text-fg/70" />
          <span className="text-sm text-muted">World Cup · TxLINE StablePrice</span>
          {started && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-pos/30 bg-pos/10 px-2 py-0.5 text-[11px] font-medium text-pos">
              <span className="h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
              {done ? "Complete" : "Live"}
            </span>
          )}
        </div>

        <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-[32px] sm:leading-[1.15]">
          Steam moves, proven on-chain before the agent acts
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {run
            ? `Replaying ${run.meta.home} v ${run.meta.away} on real recorded StablePrice odds, streamed through the live agent.`
            : "Replay a finished World Cup match on real recorded odds, streamed through the live agent with every signal proof-checked on Solana."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Pill>{run ? `z ≥ ${run.detector.zThreshold}` : "z-score detector"}</Pill>
          <Pill>{run ? `${run.detector.minMovePp}pp min move` : "Merkle-proof gated"}</Pill>
          <Pill>Solana devnet</Pill>
        </div>

        <div className="hairline mt-7 grid grid-cols-2 gap-x-4 gap-y-6 pt-6 sm:grid-cols-4">
          <Stat label="Signals" sub={started ? `${live.verified} verified` : "awaiting run"}>
            {started ? <AnimatedNumber value={live.signals} duration={0.4} className="stat" /> : <Dash />}
          </Stat>
          <Stat label="Hit rate" sub={started ? `${live.won}/${live.settled} won` : "awaiting run"}>
            {live.settled ? <AnimatedNumber value={live.hit} suffix="%" duration={0.4} className="stat" /> : <Dash />}
          </Stat>
          <Stat label="Net P&L" sub={run && done ? `ROI ${run.summary.roi >= 0 ? "+" : ""}${run.summary.roi}%` : "awaiting settle"}>
            {live.settled ? (
              <AnimatedNumber
                value={live.pnl}
                decimals={2}
                signed
                duration={0.4}
                className={`stat ${live.pnl >= 0 ? "text-pos" : "text-neg"}`}
              />
            ) : (
              <Dash />
            )}
          </Stat>
          <Stat label="Final" sub={run ? `${run.meta.home} v ${run.meta.away}` : "full time"}>
            {run && done ? (
              <span className="stat">
                {run.meta.finalHome}-{run.meta.finalAway}
              </span>
            ) : (
              <Dash />
            )}
          </Stat>
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border-strong px-2.5 py-1 text-[11px] text-muted">{children}</span>;
}

function Dash() {
  // /60 is the dimmest this can go and still clear 3:1 at the stat's ~30px size
  return <span className="stat text-muted/60">—</span>;
}

/** Big number + baseline-aligned mono caption — the reference's REWARDS/ENTRIES device. */
function Stat({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">{children}</div>
      {/* full-strength muted: at 10px this is body text and needs 4.5:1 */}
      <div className="label mt-1.5 text-[10px] tracking-[0.1em]">{sub}</div>
    </div>
  );
}

/* ─────────────────────────── section head ─────────────────────────── */
function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {meta && <span className="label">{meta}</span>}
    </div>
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold">Implied probability</h3>
          {run && (
            <span className="label">
              {run.meta.home} v {run.meta.away}
            </span>
          )}
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
    <div className="label flex items-center gap-3 tracking-[0.1em]">
      <span className="flex items-center gap-1.5">
        <i className="h-0.5 w-3 rounded bg-accent" aria-hidden />
        home
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-0.5 w-3 rounded bg-border-strong" aria-hidden />
        draw
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-0.5 w-3 rounded bg-muted" aria-hidden />
        away
      </span>
    </div>
  );
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-4 text-center">
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        Nothing plotted yet. Run the agent to stream a finished match through it and watch the odds move.
      </p>
      <button
        type="button"
        onClick={onRun}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-sm transition-colors duration-100 ease-out hover:bg-panel-2"
      >
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
        Run the agent
      </button>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-4">
      <div className="relative h-44 w-full overflow-hidden rounded-control bg-panel-2">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/5 to-transparent" />
      </div>
      <p className="label flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Running agent over real TxLINE odds…
      </p>
    </div>
  );
}

function ErrorState({ msg, onRun }: { msg: string; onRun: () => void }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-neg">Couldn’t run the agent.</p>
      <p className="max-w-sm text-xs text-muted">{msg}</p>
      <button
        type="button"
        onClick={onRun}
        className="mt-1 inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-sm transition-colors duration-100 ease-out hover:bg-panel-2"
      >
        Retry
      </button>
    </div>
  );
}

/* ─────────────────────────── badges ─────────────────────────── */
/* `hint` matters most for `unanchored`: an amber badge reads as a failure, but a
 * pending root is the expected devnet state (see SHARP_VERIFY_POLICY=advisory in
 * .env.example) — not a proof that failed. The tooltip says so. */
const PROOF: Record<string, { label: string; cls: string; icon: typeof Check; hint: string }> = {
  verified: {
    label: "on-chain verified",
    cls: "text-pos border-pos/30 bg-pos/10",
    icon: Check,
    hint: "TxLINE's Merkle proof was checked against the odds root anchored on Solana. The agent opened this position on confirmed data.",
  },
  mock: {
    label: "verified",
    cls: "text-pos border-pos/30 bg-pos/10",
    icon: Check,
    hint: "Proof check passed against a stubbed verifier. No chain hop was made.",
  },
  rejected: {
    label: "proof rejected",
    cls: "text-neg border-neg/30 bg-neg/10",
    icon: X,
    hint: "The odds update didn't match the anchored root, so the agent refused to trade this signal.",
  },
  unanchored: {
    label: "root pending",
    cls: "text-warn border-warn/30 bg-warn/10",
    icon: TriangleAlert,
    hint: "Not a failed proof. TxLINE hasn't anchored this odds root on devnet yet, so validate_odds has nothing to check it against. The advisory policy opens the position and flags it; a strict policy would drop the signal instead.",
  },
  unavailable: {
    label: "proof unavailable",
    cls: "text-warn border-warn/30 bg-warn/10",
    icon: TriangleAlert,
    hint: "TxLINE returned no Merkle proof for this update, so there was nothing to verify against the root.",
  },
  error: {
    label: "verify error",
    cls: "text-warn border-warn/30 bg-warn/10",
    icon: TriangleAlert,
    hint: "The proof check itself failed (network or RPC). The signal is flagged rather than silently trusted.",
  },
};

function StatusBadge({ status }: { status: string }) {
  const p = PROOF[status];
  if (!p) return <span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] text-muted">{status}</span>;
  const Icon = p.icon;
  return (
    <Tooltip hint={p.hint}>
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${p.cls}`}>
        <Icon className="h-3 w-3" aria-hidden />
        {p.label}
      </span>
    </Tooltip>
  );
}

function statusBar(status: string): string {
  if (status === "verified" || status === "mock") return "border-l-pos";
  if (status === "rejected") return "border-l-neg";
  return "border-l-warn";
}

/**
 * Small hint tooltip. The trigger is a real <button> so it's tab-reachable and
 * tappable, not hover-only — on touch there is no hover, and these badges are
 * the only place the proof status is explained.
 *
 * Hover is gated on pointerType === "mouse": a tap fires pointerenter *and*
 * click, which would otherwise open then immediately toggle it shut.
 */
function Tooltip({ hint, children }: { hint: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pointerType = useRef("mouse");
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        /* Each input path owns one trigger, so they can't fight:
         *  mouse    → pointerenter/leave (click ignored, it's already showing)
         *  keyboard → focus, but only a real :focus-visible focus
         *  touch    → click toggles; tap-focus is NOT focus-visible, so the
         *             pointerdown→focus→click sequence can't open-then-close. */
        onPointerDown={(e) => (pointerType.current = e.pointerType)}
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
        onFocus={(e) => e.target.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => pointerType.current !== "mouse" && setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        /* ::before widens the touch target to ~40px without altering layout —
         * the badge itself is only ~18px tall. */
        className="relative cursor-help rounded-full before:absolute before:-inset-x-2 before:-inset-y-[11px] before:content-['']"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-control border border-border-strong bg-panel-2 px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-fg"
        >
          {hint}
        </span>
      )}
    </span>
  );
}

/* ─────────────────────────── signal tape ─────────────────────────── */
function SignalTape({ run, revealed }: { run: RunResponse | null; revealed: RunEvent[] }) {
  if (!run) return null;
  const sigs = revealed.filter((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Sharp-move signals</h3>
        <span className="label">{sigs.length} detected</span>
      </div>
      {sigs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Watching the feed. No steam yet.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sigs.map((s, i) => (
              <motion.li
                key={`${s.tsMs}-${i}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={SPRING.snappy}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-l-2 border-border bg-panel-2 px-3 py-2.5 text-sm ${statusBar(s.proofStatus)}`}
              >
                <span className="font-medium">{outcomeLabel(s.outcome, run.meta)}</span>
                <span className="tnum text-xs text-muted">
                  {s.probBefore.toFixed(1)}% → {s.probAfter.toFixed(1)}%
                </span>
                <span className="tnum text-xs font-medium text-pos">+{s.movePp.toFixed(1)}pp</span>
                <span className="tnum text-xs text-muted">z={s.z.toFixed(1)}</span>
                <span className="ml-auto">
                  <StatusBadge status={s.proofStatus} />
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── verify panel ─────────────────────────── */
function VerifyPanel({ revealed }: { revealed: RunEvent[] }) {
  const latest = [...revealed].reverse().find((e): e is Extract<RunEvent, { type: "signal" }> => e.type === "signal");
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Verify-before-trade</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Every signal’s odds update is checked against TxLINE’s Merkle proof and its Solana batch root (
        <code className="tnum text-fg">validate_odds</code>) before a position opens.
      </p>
      <AnimatePresence mode="wait">
        {!latest ? (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label mt-5">
            No proof checked yet
          </motion.p>
        ) : (
          <motion.dl
            key={latest.tsMs}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="mt-5 space-y-2.5 text-xs"
          >
            <Row k="status">
              <StatusBadge status={latest.proofStatus} />
            </Row>
            {latest.root && (
              <Row k="odds root">
                <code className="tnum text-fg">{latest.root.slice(0, 18)}…</code>
              </Row>
            )}
            {latest.pda && (
              <Row k="root PDA">
                <code className="tnum text-fg">{latest.pda.slice(0, 14)}…</code>
              </Row>
            )}
          </motion.dl>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="label text-[10px]">{k}</dt>
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Positions</h3>
        <span className="label">{opens.length} open</span>
      </div>
      {opens.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No positions yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          <AnimatePresence initial={false}>
            {opens.map((o, i) => {
              const s = settleFor(o.outcome);
              return (
                <motion.li
                  key={`${o.tsMs}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING.snappy}
                  className={`rounded-control border border-l-2 border-border bg-panel-2 px-3 py-2.5 ${
                    s ? (s.won ? "border-l-pos" : "border-l-neg") : "border-l-warn"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{outcomeLabel(o.outcome, run.meta)}</span>
                    <span className="tnum text-xs text-muted">@ {o.entryOdds.toFixed(2)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="tnum text-muted">stake {o.stake}</span>
                    {s ? (
                      <span className={`tnum font-medium ${s.won ? "text-pos" : "text-neg"}`}>
                        {s.won ? "Won" : "Lost"} {s.pnl >= 0 ? "+" : ""}
                        {s.pnl.toFixed(2)}
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
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-accent" aria-hidden />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <h3 className="text-sm font-semibold">Live TxLINE feed</h3>
      </div>
      {state === "loading" && (
        <ul className="space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="relative h-6 overflow-hidden rounded bg-panel-2">
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/5 to-transparent" />
            </li>
          ))}
        </ul>
      )}
      {state === "error" && (
        <div className="text-center">
          <p className="text-xs text-neg">Live feed unavailable</p>
          <p className="mt-1 text-[11px] text-muted">{err}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex h-9 items-center rounded-full border border-border-strong px-3 text-xs transition-colors duration-100 ease-out hover:bg-panel-2"
          >
            Retry
          </button>
        </div>
      )}
      {state === "ok" && rows.length === 0 && <p className="py-3 text-center text-xs text-muted">No fixtures listed right now.</p>}
      {state === "ok" && rows.length > 0 && (
        <ul className="scroll-thin max-h-52 space-y-1 overflow-y-auto text-xs">
          {rows.map((f, i) => (
            <motion.li
              key={f.fixtureId}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING.smooth, delay: Math.min(i * 0.04, 0.3) }}
              className="flex items-center justify-between gap-2 py-1"
            >
              <span className="truncate">
                {f.home} <span className="text-muted">v</span> {f.away}
              </span>
              <span className={`label shrink-0 text-[9px] ${f.state === "started" ? "text-pos" : ""}`}>{f.state}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────── footer ─────────────────────────── */
function Footer() {
  return (
    <footer className="hairline mt-12 flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="label">Data</span>
        <span className="text-xs text-muted">TxLINE StablePrice (TxODDS)</span>
        <span className="text-muted/40" aria-hidden>
          ·
        </span>
        <span className="label">Verified</span>
        <span className="text-xs text-muted">
          Solana <code className="tnum">validate_odds</code> · devnet
        </span>
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-[11px] leading-relaxed text-muted">
          Odds are a recorded real feed; live fixtures and proof checks are fetched live.
        </p>
        {/* CC BY 4.0 requires attribution to the photographer plus a licence link. */}
        <p className="text-[11px] leading-relaxed text-muted">
          Banner photo by Krzysztof Popławski,{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-100 ease-out hover:text-fg"
          >
            CC BY 4.0
          </a>
          , via{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Mecz_pi%C5%82karski_Wis%C5%82a_Krak%C3%B3w_-_Zag%C5%82%C4%99bie_Sosnwoiec,_28_pa%C5%BAdziernika_2022,_Po%C5%BCegnanie_Stadionu_Ludowego,_KP.jpg"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-100 ease-out hover:text-fg"
          >
            Wikimedia Commons
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
