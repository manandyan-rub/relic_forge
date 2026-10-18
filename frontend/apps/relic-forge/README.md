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

The active app is `src/petal/SlotGame.svelte`, loaded by the existing SvelteKit layout and SessionGate. The retired Relic Forge UI, asset registry, and artwork have been removed. Shared context, event handling, and currency helpers remain in `src/game`. Bonus Buy is a permanent feature with Standard, Super and Mythic variants in both worlds; it is playable in explicit local development and remains locked for connected purchases pending production validation. Local SessionAuthenticate preserves the shared SDK authentication implementation while adapting branding and original-stake replay recovery without changing shared packages.

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



Bloom's one-second loop uses the 60 corrected transparent PNGs in `art/sources/bloom-corrected-spin`, in their supplied order at 60 fps. Source PNGs remain unchanged. The rebuild removes only tiny detached alpha fragments behind the right shoulder and below the feet; the 512×748 canvas, character pixels, and timing are preserved without cropping, blending, or retiming. The video uses lossless VP9 encoding with alpha, and its poster uses lossless WebP. Blight uses the first 500 ms of its original 21:29:23 clip with a two-second eased forward/return cycle at 60 fps, sampling original poses without blending. Original clips and prepared transparency inputs remain in `art/sources`; exact sources, cleanup settings, frame mappings, and hashes are recorded in `art/character-media.json` and `art/*-spin-loop.json`.

Blight's bonus loop removes only weak, near-black floor haze away from solid character pixels. The opaque robe, feet, weapon, and chain remain intact. Blight uses its cleaned spin poster as the resting image, with the same canvas and first pose as its loop. Its loop video and poster use lossless encoding with a separately preserved alpha plane.

Normal base spins use the still character artwork. Character loops run only throughout bonus features and stay silent. A short reel-spin cue plays on normal base spins when Sound effects is enabled. All bonus sound effects are muted. During bonuses, the same animation continues through all ten free spins and their pauses.

Awarded and purchased features show their server-provided free-spin count full-screen before the first spin. Bloom's grandmother and Blight's skull gnome present the count above their raised palms, using the existing character artwork. The announcement stays readable for 2.2 seconds, including in Turbo and reduced-motion modes; Start free spins, Enter, Space, or Escape can continue sooner. Escape also stops autoplay. Already-presented recovery events skip the announcement. Blight has no added character aura or warm outline glow.

Big wins (20× or more) play the corresponding five-second clip full-screen against the current world's background, with original audio controlled by Sound effects. Bloom big-win source: 21:23:21; Blight: 21:29:23. Their prepared transparency preserves soft exterior edges while restoring opacity inside dark clothing. Playback waits for a presented video frame before replacing the still and starting audio; the character and cinematic background fade out together. Win labels never appear above the side characters; totals remain below the reels and on the full-screen big-win display. Reduced motion uses still artwork.

Rebuild all current character clips and posters with Python (Pillow, NumPy, SciPy) and FFmpeg:

```powershell
python scripts/prepare-character-media.py --scratch art/qa/rebuild-characters
```

Add `--preview-only` to inspect gold and room background contact sheets before replacing runtime assets, or `--only <clip-name>` to rebuild one clip.
