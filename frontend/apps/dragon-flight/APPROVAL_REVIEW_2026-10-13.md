# Lucky Flight approval review — 13 October 2026

Development audit of `frontend/apps/dragon-flight/` on `relic-flight-prototype`. This records verified implementation and release work still required; it is not an Engine approval decision.

## Guidelines checked

- [Approval guidelines](https://stake-engine.com/docs/approval-guidelines): independent wagers, prohibited continuation/gamble mechanics, original content and submission readiness.
- [Frontend communication](https://stake-engine.com/docs/approval-guidelines/front-end-communication): usable bet controls, clear rules/payouts, mobile/popout support and asset delivery.
- [General disclaimer](https://stake-engine.com/docs/approval-guidelines/general-disclaimer): server-authoritative settlement and illustrative frontend operation.
- [Replay requirements](https://stake-engine.com/docs/approval-guidelines/game-replay-requirements): public replay without a wallet session, disabled betting and robust optional parameters.
- [RGS specification](https://stake-engine.com/docs/rgs) and [wallet API](https://stake-engine.com/docs/rgs/wallet): integer money units, permitted wagers, jurisdiction settings, recovery and settlement.
- [Quality rankings](https://stake-engine.com/docs/approval-guidelines/game-quality-rankings): coherent artwork, animation polish, device performance and loading size. This is a quality standard, not a blanket ban on AI-created artwork.

## Verified fixes

- Hunter volleys use a consistent 160ms projectile travel time at 1×; shot spacing is 160ms for Safe/Danger and 220ms for Balanced. Presentation speed scales timing. Health feedback and elimination continue to follow the authored result, not bullet collision or player input.
- Feather bursts follow the shared presentation clock. Runtime fight videos were replaced by the existing dragon sprite presentation. No new external images or video assets were added. The 12 original video files remain on disk, totaling approximately 31.65MiB.
- Bird bitmaps retain aspect ratio at 450px width, with at most two concurrent decodes across all species, shared caches, compatibility fallback and failed-load cleanup. Actual asset dimensions imply approximately **18.01MiB** retained RGBA versus **803.09MiB** at source resolution; these are allocation estimates, not browser RSS measurements.
- Bet controls use direct amount entry and −/+ buttons; the preset row was removed to simplify the panel. Authenticated levels remain reachable through entry and stepping, and repeat feature-buy labels show the actual entry cost. Invalid-input explanations remain visible, and the settings menu stays above the result card so history can be opened. Precise fractional currency amounts, independent play requests, settlement deduplication and replay without wagers remain covered by tests.
- Win count-up labels keep the final amount's decimal precision and reserve its width, with right-aligned tabular digits. Values up to wallet millionths remain exact. Fluppy's optional wager belongs only to its round; the hunter bet preference is preserved and returns immediately when Fluppy completes, including after replay.
- Fullscreen respects the authenticated restriction. Malformed optional replay currency/amount values fall back safely; required routing and server outcome validation stay strict.
- Help includes the operational disclaimer and clarifies cosmetic health/lineup choices, published-book behavior and retained base wins after Champion failure. Connected play hides the demo-only Fluppy continuation offer.

## Read-only math verification

No published math files, payout probabilities or outcome books were changed.

| Mode | Books | Entry cost | Maximum × base bet | Weighted RTP |
| --- | ---: | ---: | ---: | ---: |
| Safe | 104,448 | 1× | 20× | 96% |
| Balanced | 137,216 | 1× | 100× | 96% |
| Danger | 203,776 | 1× | 1,000× | 96% |
| Storm Run | 10 | 20× | 300× | 96% |
| Summit Expedition | 12 | 50× | 3,600× | 96% |

All **445,462** compressed books matched lookup IDs, final payout multipliers and event indexes. All five lookup tables have exact weighted RTP **24/25**, after entry cost. All **11 SHA-256 hashes** in `submission/math/math_report.json` matched. All **15** supplied replay example IDs resolved to their intended loss/win/maximum cases.

The published books contain **zero `elimination` or `championFlight` events**. They are legacy single-bird books. The decoder deliberately preserves their authoritative behavior; the four-bird/Champion presentation requires the documented versioned flock envelope.

## Automated verification

- **91 tests passed**, including fixed count-up precision and Fluppy win/loss/replay/failed-start bet preservation.
- ESLint passed.
- Svelte check: **0 errors, 0 warnings**.
- Production build passed.
- Git diff check passed.
- Asset audit resolved all **139** checked local files at root and a deployment subpath, with no missing files. Mobile bird frames, weapons, hunters and shared weather backgrounds matched source hashes.
- Source inspection found one shared game rAF loop and reused sprite/audio caches. Sustained 60fps was not measured or claimed.

## Browser verification

Tested in the local in-app Chromium browser at **320×740, 390×844, 768×1024, 1280×800 and 680×360**. Inspected screenshots and DOM bounds: no horizontal page overflow; narrow landscape requires vertical scrolling to reach the controls. These are viewport checks, not physical-device tests.

- At 320px, entering zero disabled Fly and displayed the permitted range and decimal precision; the explanation was visibly present after correcting the mobile CSS.
- Balanced selected rain and the Trail Rifle; changing lineup/hunter/launch and using Reset Defaults restored cosmetics while retaining that risk/weather.
- A local Storm Run showed the $20 initial purchase cost, locked controls during flight, and displayed **BUY AGAIN $20.00** after a zero-payout result. Settings/history remained clickable after fixing their stacking order.
- Played a Danger flock round at 2× with storm/AK-47 presentation and a zero-survivor result. Its history replay showed the same recorded $1 entry and zero payout. During replay, a feather effect and 3/4 survivors were visible with **zero video elements** in the DOM.
- Earlier development HMR errors were recorded while files were being edited. A fresh reload and the final tested flows produced no new warning/error entries. This is not a deployed network/CDN audit.
- Follow-up at 390×844: a $1 hunter win offered a $0.62 Fluppy round, which paid $1.395. Active controls showed $0.62; completed controls and the main Fly button immediately showed $1.00 again. During its replay, four counter samples from $0.063 to $0.352 kept the decimal column at exactly the same X coordinate (170.421875px) and the counter width at 180.1875px.
- After removing presets, screenshots at 320×740, 390×844, 768×1024 and 1280×800 showed compact controls without an empty preset row or horizontal overflow. Direct entry of $5.65, increment to $5.75 and decrement to $5.65 updated the Fly amount correctly. ESLint, Svelte check and production build passed again; the fresh browser tab reported no warnings/errors.

Champion transitions, live wallet settlement, public server replay and interruption recovery were covered by targeted automated tests, not visually exercised against a connected Stake session in this audit. Sustained frame timing, mobile Safari/iOS and GPU memory were not measured.

Proof screenshots: [mobile flock effect](C:/Users/user/AppData/Local/Temp/lucky-flight-approval-review.png), [repeat feature cost](C:/Users/user/AppData/Local/Temp/lucky-flight-feature-cost-review.png).
Follow-up proof: [stable three-decimal counter](C:/Users/user/AppData/Local/Temp/lucky-flight-counter-fixed.png), [hunter bet after Fluppy](C:/Users/user/AppData/Local/Temp/lucky-flight-hunter-bet-restored.png).
Simplified controls: [mobile panel without presets](C:/Users/user/AppData/Local/Temp/lucky-flight-no-presets.png).

## Release blockers and next steps

1. **Publish reviewed authoritative flock/Champion books.** The current production math cannot provide the advertised four-bird mechanic. A frontend-only upload cannot enable it. Keep feature buys separate and preserve existing published math while preparing a reviewed new version.
2. **Finish localization and jurisdiction support.** Basic controls support multiple languages, but new gameplay/rules text remains partly English. Social authentication and `social=true` public replay are intentionally blocked; Stake-US readiness is incomplete. Public replay also lacks persisted player-selected cosmetic lineup/hunter metadata, although local history retains those choices.
3. **Run connected ACP/CDN checks.** Live wallet calls, deployed assets, recovery after real interruption, currency/jurisdiction configurations and public replay against the uploaded math version have not been tested in this audit. Verify every mode's loss, win and maximum example, then flock/Champion cases against their new authoritative books.
4. **Check physical devices and popout.** Real iOS/Safari, Android, constrained devices, sustained frame rate and memory remain unverified. Browser viewport simulation is useful but cannot replace these checks.
5. **Reduce release assets and confirm rights.** The measured frontend build is approximately **99.28MiB**, including retained original videos; this is total upload size, not initial transfer. Exclude unused originals from the release package once runtime independence is confirmed, optimize large fonts/backgrounds/thumbnails, and document artwork/font rights. No repository asset budget or Engine approval guarantee is asserted.

Fluppy remains a development-only wager dependent on a previous win. Do not enable that continuation in production; the approval restrictions require independent wagers. Champion must remain an authored sequence within the same paid round, without another play request.
