# The Last Petal

A local development rebuild of the existing Relic Forge app. Work stays in this repository on `last-petal-rebuild`; no upload or push is performed.

From `frontend/apps/relic-forge`:

```powershell
pnpm dev
# Open http://localhost:3006/?demo=true
pnpm lint
pnpm exec svelte-check --tsconfig ./tsconfig.json
pnpm build
pnpm verify:browser
```

The explicit development demo cycles seven Python-authored showcase books per world: loss, small win, expansion, multiple expansion, feature, multiple paylines, and cap. It is **not a probability simulation**. Demo requires a development build, `demo=true`, and no complete or partial live credentials. Production builds require authentication or replay.

The active app is `src/petal/SlotGame.svelte`, loaded by the existing SvelteKit layout and SessionGate. The former `src/components/Game.svelte`, old symbol images and old game helpers remain historical source only; none are imported by the new game. Forge and Dragon boosts are retired. Bonus Buy is a permanent feature with Standard, Super and Mythic variants in both worlds; it is playable in explicit local development and remains locked for connected purchases pending production validation. Local SessionAuthenticate preserves the shared SDK authentication implementation while adapting branding and original-stake replay recovery without changing shared packages.

## Active responsibilities

- `WorldSelection`: authenticated BLOOM/BLIGHT eligibility; controls lock throughout rounds/features/autoplay.
- `ReelGrid`, `ReelSymbol`: 25 cells and actual supplied character/prop art.
- `CharacterStage`: restrained idle, spin, anticipation, win, expansion, feature intro, big win and ending states.
- `ExpandingWild`: full-reel expansion and persistent feature Wild presentation.
- `FreeSpinsPresentation`, `WinPresentation`: server counters, separate feature/round winnings, line breakdown.
- `BonusBuy`: world-themed selection, full-price confirmation, affordability, duplicate protection and permanent connected-release gate.
- `BetControls`, `GameSettings`: validated stake, balance, finite autoplay, Turbo, sound, reduced motion, rules, paytable and focus-managed dialogs.
- `MathEventAdapter`: fail-closed version/geometry/mode/event/payout validation, independent best-line reconciliation; never chooses an outcome.
- `rgs.ts`: shared SDK wallet calls, original stake, progress recording and one-attempt settlement; replay never writes to a wallet.

See `LAST_PETAL_CONTRACT.md` for units, events, math and readiness limits. See `art/manifest.json` for source filenames, SHA-256, output URLs, explicit crop regions and individual prop contours. Supplied originals are preserved in `art/sources` (~142 MB); optimized assets total ~2.9 MB. Missing source files: none.

The lower-value IDs are stable math identifiers, with world-specific labels: `flower` is flowerpot/stone, `lantern` is lantern/flail, `key` is brooch/pouch, `book` is hammer/shears, and `mushroom` is traveler hat/spiked club. These identifiers do not imply new generated images. Wild and Scatter are simple temporary SVG flowers pending dedicated hand-drawn special symbols.

## Generate and measure math

From `math` (keep this directory on PYTHONPATH):

```powershell
$env:PYTHONPATH=(Get-Location).Path
& env/Scripts/python.exe games/relic_forge/run.py --sims 5000
& env/Scripts/python.exe games/relic_forge/run.py --command verify-strict
& env/Scripts/python.exe games/relic_forge/simulate.py --sims 10000
```

`run.py` writes local zstd JSONL books, integer-weight CSV lookups, an index, explicit cyclic strips, canonical rules and weighted statistics to `math/games/relic_forge/library/last_petal_dev`. It also regenerates the frontend rule mirror and deterministic fixtures. This local library is ignored by the repository's existing library ignore rule; retain/regenerate it using the commands above.

Measured weighted RTP is approximately 96% in both finite development libraries. **Natural unweighted sampling is not 96%**. Its separate report is intentional; do not deploy natural-simulation lookup weights while citing the calibrated report. Production export is explicitly blocked. The old six-mode Rust optimizer setup is retired; new production-scale optimization remains pending.

Browser QA uses installed headless Chrome/Edge through CDP and local intercepted RGS fixtures. It is not Playwright and does not prove real Stake staging integration. `art/qa/browser-results.json` records actual checks and screenshots. Do not use the old generated Relic Forge libraries for this frontend.



## Bonus Buy

See `BONUS_BUY.md` for all six prices, measured RTP/volatility/max exposure and release requirements. The new modes are `BLOOM_STANDARD_BONUS`, `BLOOM_SUPER_BONUS`, `BLOOM_MYTHIC_BONUS`, `BLIGHT_STANDARD_BONUS`, `BLIGHT_SUPER_BONUS`, and `BLIGHT_MYTHIC_BONUS`.

`bonus_rules.json` defines independent server profiles. The exporter derives rounded integer prices from each profile's source population, then calibrates positive book weights and recomputes purchase-normalized statistics. It writes `bonus_pricing.json`, six book/weight pairs, `bonus_statistics.json`, `stake-mode-config.json` using the SDK's `pass_fe_betmode`, an integrity manifest, and generated frontend config/fixtures. All six `connectedApproved` fields stay false.

The wallet request sends the original base bet with the exact purchase mode; the mode cost multiplier determines the full debit. Book payouts remain multiples of the base bet. The `bonusStart` event carries the original price for recovery/replay receipts, so later catalog changes cannot silently rewrite historical purchase costs. No synthetic base spin or Scatter win is inserted into purchased features.



Current character presentation: both worlds use their supplied transparent videos and original audio. Bloom spin uses 21:18:08 seconds 1–2; Bloom big win uses 21:23:21 seconds 0–5. Blight spin uses 21:29:23 seconds 3–4; Blight big win uses seconds 0–5. Both bonus features keep the spin video/audio running across all ten free spins and pauses. Big wins (20× or more) fill the screen with the world background and winnings above the character. The side character never shows a win label. Regular and feature totals appear below the reels; only the full-screen big-win display shows the large prize. Reduced motion restores still art; Sound effects controls original audio.
