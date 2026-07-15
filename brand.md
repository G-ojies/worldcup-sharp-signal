# Brand — SharpSignal

_Status: active — set 2026-07-15_

Flat editorial dark. Near-black surfaces, cream text, one violet accent, monospace
micro-labels. The reference point is a calm, restrained "quest board" look rather
than a glowing trading terminal: **borders instead of glows, type instead of
chrome**. Colour is scarce on purpose — when violet or green appears, it means
something.

Tokens live as CSS variables in `app/globals.css` and are mapped into Tailwind in
`tailwind.config.ts`. Components reference tokens (`bg-panel`, `text-muted`,
`border-border`) and never hardcode hex.

## Palette

| Token | HSL | Role |
|---|---|---|
| `--bg` | `40 6% 4%` | page base |
| `--bg-2` | `40 6% 5%` | base alt |
| `--panel` | `40 5% 7%` | card surface |
| `--panel-2` | `40 5% 11%` | nested row / skeleton |
| `--border` | `40 5% 15%` | hairline |
| `--border-strong` | `40 5% 22%` | pills, secondary buttons |
| `--fg` | `40 20% 91%` | cream body text |
| `--muted` | `40 6% 58%` | secondary text (6.4:1 on panel) |
| `--accent` | `252 100% 64%` | violet — the one accent |
| `--cream` | `40 22% 89%` | primary CTA fill (dark text on cream) |
| `--pos` / `--neg` / `--warn` | `145 58% 55%` / `2 70% 62%` / `38 88% 60%` | semantic only |

**Greys are warm** (hue 40, low saturation) so they sit under the cream
foreground without going muddy. Don't introduce cool/blue greys — mixing
temperatures is what makes this look cheap.

### Two constraints worth not re-litigating

1. **`--accent` is L=64, and that is load-bearing.** It has two jobs with
   opposing needs: white-on-violet button text wants a *darker* violet, violet
   graphics on near-black want a *lighter* one. L=64 is where both pass —
   white-on-violet **5.26:1**, violet-on-bg **3.76:1**. Lightening it to 68 (the
   more "reference-accurate" violet) drops white-on-violet to **4.35:1** and
   fails AA. `--accent` is never used as body text, so 3.76 is fine for the dots,
   chart line, icons and focus ring it actually paints.
2. **Don't dim `--muted` with opacity at small sizes.** `text-muted/70` at 10–11px
   measures 3.71:1 and fails AA for body text. Use `--muted` at full strength;
   it's already the quiet colour. The one exception is the `—` placeholder in a
   stat cell, where `/60` (3.04:1) is acceptable because it renders ~30px.

## Typography

- **Sans:** Geist (`geist/font/sans`, self-hosted — no network at build).
  Headings are `font-semibold tracking-tight`; the page H1 is `text-5xl sm:text-6xl`.
- **Mono:** Geist Mono (`geist/font/mono`) — carries the micro-label device and
  every number.
- `.label` — 11px mono, uppercase, `0.14em` tracking, muted. This is the
  signature: `LIVE AGENT`, `REWARDS`, `FOUR STAGES`, `AWAITING RUN`.
- `.stat` — big tabular mono figure for hero stat cells.
- `.tnum` — tabular mono for any number that changes, so digits don't jitter.

`.label` / `.stat` / `.card` / `.tnum` / `.hairline` live in `@layer components`
so Tailwind utilities still override them (`label text-pos` works without `!`).

## Shape and motion

- One radius per class: cards `--radius` (14px), controls `--radius-sm` (8px),
  buttons and pills fully rounded.
- **Borders, never shadows.** No glow, no `box-shadow` elevation, no page-wide
  ambient gradients. The hero's violet wash is the single full-bleed exception,
  and it sits under a scrim that guarantees text contrast.
- Icons: `lucide-react` only, `strokeWidth={1.5}`. No emoji.
- Transitions name their properties (`transition-[opacity,transform]`), never
  `all`. Hover/press feedback is 100ms; entrances are springs from
  `components/motion.tsx`.

## Voice

Plain, specific, lowercase-tolerant in labels but sentence case in prose. State
what the agent did, not how impressive it is. "Watching the feed — no steam yet."
not "No data available at this time." Never claim verification the run didn't
actually produce — `proof unavailable` is a real, honest state and it renders as
amber, not as a failure.
