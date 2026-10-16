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

See `LAST_PETAL_CONTRACT.md` for units, events, math and readiness limits. See `art/manifest.json` for source filenames, SHA-256, output URLs, explicit crop regions and individual prop contours. Supplied originals and lossless motion inputs are preserved in `art/sources`; only runtime assets are shipped. Missing source files: none.

The lower-value IDs are stable math identifiers, with world-specific labels: `flower` is flowerpot/stone, `lantern` is lantern/flail, `key` is brooch/pouch, `book` is hammer/shears, and `mushroom` is traveler hat/spiked club. These identifiers do not imply new generated images. Individual Wild and Scatter symbols use SVG flowers.

Winning paylines trace the exact paid symbol positions from the authoritative event book. Multiple wins cycle individually with matching line details; new reveals clear the overlay. Before a base-game big-win video, each paid line is shown once for 800 ms. A pointer press anywhere (or Space/Escape) skips this presentation without activating controls underneath; recovery skips already-presented events and reduced motion bypasses the pre-video delay. Bloom uses warm gold trails, Blight uses copper and violet trails. Reduced motion shows a static trail. Expanded and sticky Wild columns retain their original vine and multiplier presentation.

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



Bloom uses the first 500 ms of its previous edited spin loop, with a one-second smooth return cycle. Blight uses the first 500 ms of its original 21:29:23 video, with a two-second smooth return cycle. Both render at 60 fps with transparent backgrounds and temporal blending. Lossless prepared inputs are preserved in `art/sources/bloom-spin-input.mkv` and `art/sources/blight-spin-input.mkv`. Exact frame mappings and output hashes are recorded in `art/*-spin-loop.json`. `scripts/prepare-character-loop.py` accepts `--video` to rebuild directly from those inputs.

Normal base spins use the still character artwork. Character loops run only throughout bonus features and stay silent. A short reel-spin cue plays on normal base spins when Sound effects is enabled. All bonus sound effects are muted. During bonuses, the same animation continues through all ten free spins and their pauses.

Big wins (20× or more) play the corresponding five-second clip full-screen against the current world's background, with original audio controlled by Sound effects. Bloom big-win source: 21:23:21; Blight: 21:29:23. Win labels never appear above the side characters; totals remain below the reels and on the full-screen big-win display. Reduced motion uses still artwork.

Rebuild the current loops with Python (Pillow/NumPy) and FFmpeg:

```powershell
python scripts/prepare-character-loop.py --video art/sources/bloom-spin-input.mkv --source-start 0 --source-duration 0.5 --source-fps 60 --cycle-duration 1 --source-kind previous-two-second-loop --output-name bloom-traveler-spin --scratch art/qa/rebuild-bloom
python scripts/prepare-character-loop.py --video art/sources/blight-spin-input.mkv --source-start 0 --source-duration 0.5 --source-fps 24 --cycle-duration 2 --output-name blight-keeper-spin --scratch art/qa/rebuild-blight
```
