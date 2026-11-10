# The Last Petal: Stake Engine submission guide

Prepared 9 November 2026 against the published approval guidelines (`stake-engine.com/docs/approval-guidelines/*`) and Engine's AI review prompt (guideline IDs in brackets).

## 1. What to upload

| Part | Upload this | Notes |
|---|---|---|
| Front end | contents of `frontend/apps/relic-forge/build/` (`index.html` at the root) | Rebuild with `pnpm build`. ~12 MB, static files only, no external hosts. |
| Math | the 17 files in `math/games/relic_forge/library/stake_upload/` | `index.json` + 8 `lookUpTable_*.csv` + 8 `books_*.jsonl.zst` (~320 MB). Regenerate with `run.py --sims 100000` (≈5 min), then rebuild this folder. |

Studio also needs a **3:4 tile and a 16:9 cover** built in the Media editor: bright background, one enlarged character, no extra text such as "BONUS" or "5000x".

## 2. Math (measured from the upload files)

| Mode | Cost | RTP | Hit rate | Max win | Max-win odds | Sims |
|---|---|---|---|---|---|---|
| BLOOM | 1× | 96.20% | 40.36% | 5,000× | 1 in 2,000,000 | 110,020 |
| BLIGHT | 1× | 96.20% | 32.20% | 5,000× | 1 in 2,000,000 | 110,020 |
| BLOOM_STANDARD_BONUS | 26× | 96.20% | 87.17% | 5,000× | 1 in 8,333 | 50,001 |
| BLOOM_SUPER_BONUS | 256× | 96.20% | 95.57% | 5,000× | 1 in 236 | 50,001 |
| BLOOM_MYTHIC_BONUS | 532× | 96.20% | 95.96% | 5,000× | 1 in 200 | 50,001 |
| BLIGHT_STANDARD_BONUS | 295× | 96.20% | 92.72% | 5,000× | 1 in 200 | 50,001 |
| BLIGHT_SUPER_BONUS | 927× | 96.20% | 97.39% | 5,000× | 1 in 200 | 50,001 |
| BLIGHT_MYTHIC_BONUS | 1000× | 96.20% | 96.32% | 5,000× | 1 in 200 | 50,001 |

All critical tests pass: base cost 1×, base std dev ≥ 0.6, RTP 96.0–96.7%, max win ≤ 1,000,000×, cost ≤ 50,000×. All non-critical tests pass too: cost ≤ 5,000×, std dev ≤ 60, CVaR, tail probabilities and ETL are all inside the limits, so no exposure penalty should apply. Every book matches its lookup row and `finalWin`. `run.py --command verify-strict` passes 44/44. Replay IDs for each scenario are in `math/games/relic_forge/library/last_petal_dev/REPLAY_EVENT_IDS.md`.

## 3. Guideline status

| ID | Guideline | Status |
|---|---|---|
| 181 / 274 | Authenticate on `rgs_url`; invalid URL shows an error | PASS. The scheme is added only when missing, and `example.com` shows "session could not be authenticated". |
| 183 / 242 / 187 | Play request, bet levels from authenticate, active-round bet restored | PASS (browser suite). |
| 275 | No Stake Engine loader | PASS. The game uses its own flower loader. |
| 213 | Title | PASS. "The Last Petal" contains no restricted terms. |
| 219 / 273 | Currencies and sub-cent payouts | PASS. USD, EUR, CAD, MXN, JPY, USDT, BTC (6 dp), SC/GC follow Stake's table; small payouts widen decimals. |
| 221 | No end-round for 0× | PASS. Skipped when inactive or `payoutMultiplier`/`payout` is 0. |
| 222 | No play without balance | PASS. The button is disabled and "Insufficient balance" is shown. |
| 228 / 104 / 31 / 107 | Space bar, autoplay confirm, >2× confirm, mute all sound | PASS. |
| 227 / 193 / 195 / 194 / 223 | No scroll; 1024×576, 400×225, 800×450, 425×812; no double-tap zoom | PASS (screenshots checked). |
| 25 / 24 / 26 / 27 / 29 / 235 / 185 | Rules: RTP and max win per mode, paytable, lines, mode costs, free spins/no retrigger, controls guide, disclaimer | PASS. Values come from the math reports. |
| 239 / 240 | English; unknown `lang` falls back | PASS (17 languages, 274 checks). |
| 77 / 78 / 225 / 188 | Social mode wording, SC/GC, mode names, replay | PASS. A DOM scan with `social=true&currency=XSC` finds no restricted words and no "$". |
| 171–174 / 243 | Replay: loads, plays, play again, shows cost, popout S | PASS (browser suite); real Stake replay is still to be tried. |
| 217 | No child-like characters | **NEEDS A HUMAN: high risk.** The Bloom traveler (main character, reel symbol, bonus card) can read as a teenager. Consider redrawing him as clearly adult (taller proportions, older face, stubble). |
| 253 | Distinct from existing titles | NEEDS A HUMAN. Original hand-drawn art. |

## 4. Before you press Submit

1. Upload both parts and launch the game from Studio. Play a normal spin, a win, a Bonus Buy, and a reload mid-feature.
2. Use Studio's **Social Mode** toggle and play once.
3. Open one replay per mode with the IDs above.
4. Build the 3:4 and 16:9 tiles.
5. Decide on the Bloom traveler artwork (guideline 217).

Reviewer star ratings are subjective. Nothing here guarantees the 6/9 points, but every written requirement that can be checked in code now passes.
