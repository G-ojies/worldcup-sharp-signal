# TxLINE API — builder feedback

Our experience integrating TxLINE for SharpSignal (Trading Tools and Agents track).

## What worked really well

- **Demargined `Pct` is the standout feature.** Getting consensus implied probabilities already stripped of bookmaker margin meant our whole signal is margin-invariant and directly interpretable ("the market's belief moved X points") — no de-vigging on our side. It's the reason the detector is a few lines of defensible math instead of a pipeline.
- **`SuperOddsType` + `PriceNames` + `Pct` alignment** is clean and consistent across markets. Filtering to `1X2_PARTICIPANT_RESULT` with `MarketPeriod = null` for the full-match market was straightforward once we understood it.
- **`GET /api/odds/updates/{fixtureId}` returning the full recorded history** for a finished fixture was a lifesaver for a reproducible demo — we replay a real match (Switzerland 2-0 Algeria) through the live agent instead of a synthetic mock.
- **The two-token auth** (guest JWT + `X-Api-Token`) and the free World Cup tier subscription flow were smooth.
- **`validate_stat` / `validate_odds` on-chain proof design** is genuinely novel and exactly what a "verify-before-trade" agent wants — the program owning the leaf hashing means we never have to reverse-engineer the serialization.

## Friction / suggestions

1. **Odds Merkle roots aren't anchored on devnet.** `daily_scores_roots` PDAs exist on devnet, but `daily_odds_roots` PDAs do not for any day we checked — so `validate_odds` has no root to verify against on the free tier. We built the full call anyway (mainnet-ready) and fall back to a transparent `unanchored` status. **Ask:** publish odds roots on devnet too, so builders can demonstrate the odds proof path end-to-end before mainnet.
2. **`GET /api/odds/validation` requires both `messageId` *and* `ts`.** With only `messageId` it 404s (no 400 explaining the missing param). Documenting that `ts` is mandatory — or keying purely on `messageId` — would save debugging time.
3. **`GameState` is unreliable** — often `null` or "scheduled" even for in-play/finished fixtures. We ended up driving match phase from `InRunning` (odds) and `Action = game_finalised` (scores) instead. Worth a doc note.
4. **Odds field-level response schema is "NOT IN DOCS."** We reverse-derived the `OddsPayload` shape from live payloads + the OpenAPI `Odds` component. A concrete example JSON per endpoint would speed onboarding.
5. **Finished fixtures drop out of `/api/odds/snapshot` and `/api/fixtures/snapshot` quickly**, while `/api/odds/updates/{fixtureId}` still returns their history — a small note on retention windows per endpoint would help builders pick the right one.

Net: the data quality (StablePrice) and the on-chain proof model are excellent. The main gap for hackathon builders was demonstrating the **odds** proof on devnet.
