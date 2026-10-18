# Last Petal v1 math and presentation contract

Canonical rules: `math/games/relic_forge/rules.json`; generated frontend mirror: `src/petal/rules.json`. Contract discriminator: `last-petal-v1`. The active Python model and frontend both require five reel-major columns of five symbols and the same 20 explicit zero-based payline paths. The complete source paytable gives **integer hundredths of total bet**, not line bet. Original game identifier/folder `relic_forge` is retained for local integration continuity; the game title is The Last Petal.

## Sources and scope

RGS flow and progress semantics were checked against official [RGS documentation](https://stake-engine.com/docs/rgs), [wallet endpoints](https://stake-engine.com/docs/rgs/wallet), [math format quick start](https://stake-engine.com/docs/math/quick-start) and [event snapshots](https://stake-engine.com/docs/math/game-state-structure/events). Requests continue to use this repository's Stake Web SDK helpers. Custom Last Petal events are versioned game events, not claims of standardized SDK events.

## Units and rules

- Wallet `amount` and `payout`: integer API currency units, `API_AMOUNT_MULTIPLIER = 1,000,000`.
- Book `payoutMultiplier`, event amounts, winInfo totals, credited line wins and base line wins: integer 0.01x total-bet units. An exported book payout of 120 means 1.20x. The wallet response's `round.payoutMultiplier` uses decimal x (1.20). Fixture wrapping explicitly performs this conversion.
- Display conversion is original round stake × book amount / 100, exactly once. Recovered rounds and replays retain their original wallet amount, independently of the current bet selector.
- Each line pays its highest eligible left-to-right 3/4/5 match. Wild substitutes for eight paying symbols, never Scatter. All-Wild pays Keeper (the highest paytable). Twenty lines are included in the displayed stake.
- One multiplier per expanded reel, selected by Python. Sum multipliers on **participating Wild reels within the matched prefix**, once per reel; identity 1 when none. Multipliers are not multiplied together or re-applied to `winInfo` totals.
- Bloom multiplier pool: 2, 3. Blight: 2, 3, 5, 10. Full-reel Wilds expand in base and feature play. Base expansion lasts one spin. Feature reels keep their original multipliers and are restored before every reveal. A new Wild on a sticky reel cannot change its multiplier.
- Three Scatters trigger ten Free Spins. No retrigger exists. Optional purchased entries use the separate bonus contract described below. At the round cap, credited line wins stop in ascending line order. `uncappedWin` records raw line arithmetic; `win` is the actual credited amount. The cap is 500,000 book units = 5,000x; feature play stops immediately at the cap.
- The rare explicit cap path uses allowed world multipliers and a legitimate Scatter-triggered feature. It is included in the finite weighted library at approximately 1 in 100 million rounds and is covered by the reported variance/exposure.

## Events

All events have contiguous integer `index`, starting at zero. A purchased feature starts with `bonusStart` instead of a base-game reveal. No event follows finalWin. The entire book is validated before playback; unknown contracts, symbols, events, world mismatches, incorrect dimensions, lost sticky state, missing/bad wins, incorrect multipliers, feature counts or payout mismatches stop play. No live/demo fallback is possible.

| Event | Authoritative payload | Presentation |
|---|---|---|
| reveal | `contract`, `world`, `gameType`, `board[reel][row]`, anticipation | Show seed Wilds and already-sticky full reels. Board cells accept IDs or SDK `{name}` objects. |
| expandWilds | `wilds: [{reel,row,multiplier}]`, `sticky` | Seed Wild pauses; character reacts; vines/roots fill reel. |
| stickyWildState | full `wilds: [{reel,multiplier}]` | Replace feature snapshot after expansion; never choose or alter multipliers. |
| winInfo | `totalWin`, `wins[]` | Highlight exact paths. Each win includes symbol, kind, positions, credited win, uncappedWin and meta (`lineIndex`, `winWithoutMult`, `lineMultiplier`). |
| setWin | single-reveal credited `amount` | Check against winInfo; no wallet credit. |
| setTotalWin | cumulative round `amount` | Round ticker; feature ticker subtracts the base-game total. |
| freeSpinTrigger | `totalFs:10` | Start feature and clear base-only expansion. |
| updateFreeSpin | ordinal `amount:1..10`, `total:10` | Each update must precede exactly one free reveal. |
| freeSpinEnd | feature-only credited `amount` | Feature summary, then finish playback. |
| wincap | `amount:500000` | Cap notice; feature may stop early. |
| finalWin | full-round credited `amount` | Check cumulative amount and wallet payout; exactly one settlement opportunity. |

## Session, recovery and replay

A normal-spin mode is `BLOOM` or `BLIGHT`, cost 1. Six additional Bonus Buy modes are defined in `BONUS_BUY.md`. Authentication must advertise that mode at cost 1 and not as Bonus Buy. The selected world is passed unchanged to `/wallet/play`. Modes/bets are locked throughout the unresolved round and its Free Spins. An explicit local demo never overrides complete or partial session parameters.

For each unacknowledged event, `/bet/event` records its index after presentation. On recovery, the frontend reconstructs earlier board/sticky/counter/win state without animation, resumes after the saved event, and does not place another wager. The full book is still validated first. At most one `/wallet/end-round` attempt is made per active round identity per mounted session, after playback. Already-inactive rounds skip recording and end-round. An uncertain request locks new wagering; reload/authenticate is required rather than retrying financial requests. Read-only replays do not wager, record progress or settle.

Autoplay is a finite ten-spin sequence with a stop control. Jurisdiction flags for autoplay, Turbo and Spacebar are honored. Minimum-round duration uses actual elapsed time even in Turbo/reduced motion. Currency and allowed stake levels come from authentication. Missing or invalid sessions show an error. Responsible net-position/session-time flags are presented when enabled; runtime fullscreen controls do not exist. Bonus Buy remains visible and uses the jurisdiction and connected-release gates described below.

## Development statistics and production boundary

The server generator samples explicit 97-stop cyclic strips, world-specific expanding-Wild probabilities, and server-selected Scatter entry. No frontend RNG exists. `run.py` builds a stratified finite outcome library (5,501 books/world with the default command) and calibrates positive integer group weights to ~96%. Bonus probability is fixed separately; weighted statistics are recomputed from every exported payout and actual rounded CSV weight. Win/loss reweighting means the unweighted generator is a different distribution and is **not** claimed to meet 96%.

The report includes weighted RTP, hit frequency, bonus frequency, population variance/standard deviation, mean triggered-round payout and maximum exposure. Feature-return means include any base win on their trigger and the rare cap tail. These are exact statistics of the finite exported development libraries, not estimates of certified production strips. Natural Monte Carlo reports are separately labeled.

Before submission: build much larger and more varied source libraries, independently validate distribution/tail/feature coverage and rounding for every supported currency, complete new optimizer objectives/acceptance and official RGS verification, obtain provider identifiers, validate real authenticated mode advertising/staging/recovery/replay, and obtain approval. The legacy optimization tool intentionally refuses to run for the new game, and `run.py --command production` refuses export. No math package was uploaded.

## Art and animation boundary

`art/manifest.json` records every actual supplied filename and derivative. Character alpha and aspect ratio are preserved, backgrounds remain separate, originals remain intact. Per-prop contour masks remove atlas neighbors without synthesizing pixels. The rejected basket was replaced by the complete traveler hat; hammer/shears use smaller sizing. All lower symbols use supplied art; the two special flowers are explicitly temporary SVG placeholders awaiting original hand-drawn specials.

Character states provide restrained translation/rotation and aura changes. Complex independent eye/arm/flowerpot motions need separated body/face/arm layers or hand-drawn reaction frames. Both worlds use supplied transparent videos and original audio controlled by Sound effects; see current presentation below. State/timeline cancellation on unmount never creates a second financial request. Dedicated final specials, character layers, authored audio and final device/performance review remain production art tasks.


## Purchased feature extension

See `BONUS_BUY.md` for current development prices and detailed mode definitions. Canonical profiles are `math/games/relic_forge/bonus_rules.json`; prices are generated into `bonus_pricing.json` and the frontend `bonus-config.json`.

`bonusStart` is the first event of a purchased book, with `contract:last-petal-v1`, `world`, exact six-mode `mode`, `variant`, `totalFs:10`, and positive integer `purchaseCostMultiplier`. It immediately establishes feature state, followed by `updateFreeSpin:1` and a free-game reveal. It awards no base spin, Scatter win or extra bet. `baseGameWins` is zero. Normal spin-in features continue using `freeSpinTrigger` after a genuine Scatter board.

Each purchase has its own multiplier pool and Wild frequency. Super guarantees at least one expanded Wild reel on Free Spin 1. Mythic additionally guarantees at least 8x in Bloom or 20x in Blight. The decoder derives guarantees from the trusted profile and rejects missing or inadequate starting Wilds, rather than accepting a claim from an arbitrary event. All subsequent snapshots obey the existing sticky/full-reel and integer payout rules.

The original stake stays separate from the full purchase cost: request amount is the base bet, full debit is base bet times mode cost, and payout is base bet times book multiplier. RTP and purchase-normalized volatility divide winnings by the full purchase cost. The 5,000x ceiling is relative to the base bet. New purchases must match both the confirmed mode and cost. Recovered/replayed receipts use the price recorded inside the original book, not today's catalog; recovery does not re-run purchase eligibility or place another wager.

A shared transport guard and synchronous presentation lock prevent duplicate requests. Selection/cancellation never charge. Confirmation freezes world, stake, currency, mode and full cost, then revalidates them, available balance, jurisdiction and release approval immediately before purchase. Feature and final totals remain separate from the wallet, which settles once after playback. Replay never writes. Failed or uncertain responses keep wagers locked.

`connectedApproved:false` is generated for every buy mode. Neither URL flags nor authenticated mode advertising can bypass this release gate. After independent production validation and a deliberate release, future eligibility must also require jurisdiction permission, an advertised exact mode at the approved cost, and `buyBonus:true`. The current release does not enable connected purchases.

Bloom uses the 60 corrected PNGs in `art/sources/bloom-corrected-spin`, in their supplied order at 60 fps for a one-second loop. Only tiny detached alpha fragments behind the shoulder and below the feet are removed; source PNGs remain unchanged. Blight uses the first 500 ms of its original 21:29:23 video, with a two-second eased forward/return cycle at 60 fps. Neither loop blends poses. Current sources, cleanup settings, frame mappings, and hashes are recorded in `art/character-media.json` and `art/*-spin-loop.json`. Rebuild clips with `scripts/prepare-character-media.py --scratch <temporary-directory>`.

Blight's bonus loop conservatively removes weak, near-black floor haze at least four pixels from solid artwork, within its fixed floor region. Solid robe pixels, feet, and the weapon and chain remain protected. Its resting image uses the cleaned spin poster so its canvas and first pose match the animation. The loop video and poster use lossless encoding with preserved alpha.

Normal base spins use the still character artwork. Character loops run only throughout bonus features and stay silent. A short reel-spin cue plays on normal base spins when Sound effects is enabled. All bonus sound effects are muted. During bonuses, the same animation continues through all ten free spins and their pauses.

Big wins (20× or more) play the corresponding five-second clip full-screen against the current world's background, with original audio controlled by Sound effects. Bloom big-win source: 21:23:21; Blight: 21:29:23. Win labels never appear above the side characters; totals remain below the reels and on the full-screen big-win display. Reduced motion uses still artwork.
