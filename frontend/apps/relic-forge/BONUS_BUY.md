# The Last Petal — Bonus Buy implementation and release report

Bonus Buy is a permanent target feature and now exists in both worlds. Three variants are implemented per world, with six separately generated server-authoritative distributions. It is playable in the explicit local development demo. Connected purchasing remains locked.

## Variant mechanics

| Variant | Entry and guarantee |
|---|---|
| Standard | Immediately starts 10 Free Spins with that world's normal expanding/sticky Wild profile |
| Super | 10 Free Spins, at least one expanding Wild reel guaranteed on Free Spin 1 |
| Mythic | 10 Free Spins, a starting Wild of at least 8x in Bloom or 20x in Blight guaranteed on Free Spin 1 |

Starting reels and values are chosen by Python, remain sticky throughout the feature and are present in the authoritative snapshots. There is no browser RNG, simulated Scatter entry, base-spin payout or new per-spin charge. The cap can stop a feature early. A guaranteed Wild is not a guaranteed payout.

Profiles, including additional Wild probability and full multiplier pools, are individually specified in `math/games/relic_forge/bonus_rules.json`. Standard uses its world's normal feature profile; Super and Mythic use distinct profiles. All 15,006 generated purchased books were reconciled, including guarantees on every first Free Spin and cap examples. Base-game development probabilities and books remain unchanged.

## Derived development prices and statistics

Default generation uses 2,500 independent source features per purchase mode, plus an explicit valid 5,000x cap path: 2,501 books per mode. Prices are computed as the nearest positive integer to source mean payout / 0.96. They are not inherited from Relic Forge. Small low/high-population reweighting then gives approximately 96% RTP at the rounded price. Every exported book retains positive integer selection weight; statistics are recalculated from the exact exported CSV weights.

| World / mode | Cost (base bet x) | Weighted RTP | Mean payout (base bet x) | Standard deviation (base bet x) | Standard deviation (purchase x) | Max payout (purchase x) |
|---|---:|---:|---:|---:|---:|---:|
| Bloom Standard | 29 | 96.00000% | 27.84 | 126.4724 | 4.3611 | 172.4138 |
| Bloom Super | 241 | 96.00000% | 231.36 | 550.3706 | 2.2837 | 20.7469 |
| Bloom Mythic | 628 | 96.00000% | 602.88 | 1,032.5410 | 1.6442 | 7.9618 |
| Blight Standard | 315 | 96.00000% | 302.40 | 756.8118 | 2.4026 | 15.8730 |
| Blight Super | 1,466 | 96.00000% | 1,407.36 | 1,740.5491 | 1.1873 | 3.4106 |
| Blight Mythic | 2,514 | 96.00000% | 2,413.44 | 2,007.2969 | 0.7984 | 1.9889 |

Maximum total payout for every mode is **5,000x the base bet**. This is not 5,000x the purchase price. For a $0.20 base bet the prices are Bloom $5.80 / $48.20 / $125.60 and Blight $63.00 / $293.20 / $502.80; maximum return is $1,000.

The high Super/Mythic prices follow from sticky reels and their enhanced profiles. In particular, Blight Mythic's maximum is only about 1.99x its full purchase cost under the retained cap. These economics require production-scale player-experience and tail review; they are not final approved commercial prices. Higher absolute payout variance does not necessarily mean higher purchase-normalized variance.

These are exact theoretical statistics of finite weighted development libraries, not certification or estimates of the unlimited natural generator's theoretical RTP. Changing population size/profile may produce new derived prices; treat a new catalog/books/hash set as a new release. Historical receipts carry their original cost in `bonusStart`.

## Interface and financial safeguards

The persistent Bonus Buy control opens a three-option panel matching the selected world. Bloom uses warm gold, green plants and the supplied friendly characters; Blight uses muted gold, shadow colors and the supplied evil characters. Desktop uses three cards, mobile uses stacked cards. Each card shows its guarantee, cost multiplier and full currency price.

Selecting a card does not place a wager. A separate confirmation shows world, variant, base bet, price multiplier, full cost and maximum payout. Insufficient balance disables purchase; changing world/bet is locked while the panel or round is active. The quote is revalidated at confirmation. Rapid double clicks can produce only one debit/feature and one settlement. The request uses the existing Stake SDK `requestBet` with base bet amount and the exact mode name.

Purchased books begin with `bonusStart` and enter the feature directly. The normal reel/Wild/sticky/counter pipeline presents them, records progress and settles active rounds once. An unfinished purchase can recover partway through the feature without another purchase. Replay remains read-only. Receipts show original price, total feature winnings and original base stake.

Official reference for cost denomination: [Stake RGS documentation](https://stake-engine.com/docs/rgs). [Replay requirements](https://stake-engine.com/docs/approval-guidelines/game-replay-requirements) informed original-cost receipts. The local SDK's `pass_fe_betmode` produces the generated development mode metadata, including cost and `buyBonus` flags.

## Generated files

The local `math/games/relic_forge/library/last_petal_dev/` contains six `books_<MODE>.jsonl.zst` / `lookUpTable_<MODE>.csv` pairs, updated eight-mode `index.json`, `bonus_config.json`, `bonus_statistics.json`, `stake-mode-config.json` and SHA-256 `integrity.json`. Source profiles and generated `bonus_pricing.json` are beside the math code. The existing library ignore rule still applies; regenerate local artifacts using the app README commands.

`stake-mode-config.json` uses the official SDK's `pass_fe_betmode` serializer for all eight modes and is explicitly `developmentOnly:true`. It is review metadata, not a claim that a provider package has passed official production verification or has been uploaded. SDK `GameConfig` defines the six actual buy modes with their derived costs and `is_buybonus=True`.

Frontend config, 18 deterministic purchased fixtures (three per mode), and measured statistics are generated into `src/petal/`. Those fixtures showcase mechanics, not sampled gambling probabilities. The six independent lookup distributions are selected by the server in a future approved release.

## Validation

- PASS: 39 Python tests, including payout and weight reconciliation, 20 paylines, multiplier addition, cap handling, full sticky state, all purchased-book starting guarantees, pricing formula, SDK flags/costs and artifact SHA-256.
- PASS: 118 CDP browser checks, including all six purchases, full-cost confirmation, cancel without debit, insufficient funds, double-click protection, feature reconciliation, historical-price recovery, read-only purchase replay, connected-release denial and jurisdiction restrictions.
- PASS: Svelte check with zero errors and warnings; ESLint; production build.
- PASS: desktop/tablet/phone layout checks; desktop and mobile Bonus Buy screenshots visually inspected.
- NOT RUN: real Stake staging, official production RGS/package validation, production-scale optimizer, Playwright (browser tests use installed headless Chrome/Edge through CDP).

## Connected release gates and remaining work

All six `connectedApproved` flags are false. Purchase buttons explain the pending validation in connected play, and the transport refuses the request even if authentication advertises a mode with a matching cost. `disabledBuyFeature` and replay independently disable the control. Bonus Buy is retained in the final interface.

Before enabling connected purchase: independently review much larger populations and purchase economics; approve immutable costs/profiles/books; complete official production packaging and verification with real provider identifiers; verify actual wallet debit/payout denominations, authenticated `buyBonus` flags/costs, interruptions and replay against Stake staging; then deliberately release the approved configuration. A successful local suite never flips these flags automatically.

No push, upload or connected purchase release was performed.
