# Lucky Flight cleanup and approval review — 14 October 2026

Development review of `frontend/apps/dragon-flight/` on `relic-flight-prototype`. This report records the presentation cleanup, the reviewer's unresolved concerns and the verification boundary. It is not an Engine approval decision. The [13 October audit](./APPROVAL_REVIEW_2026-10-13.md) remains a historical record of its tested version.

## Review standard

The [official approval guidelines](https://stake-engine.com/docs/approval-guidelines) require original content, clear communication, technical readiness and independent wagers. The [quality rankings](https://stake-engine.com/docs/approval-guidelines/game-quality-rankings) call for cohesive artwork, polished animation, device testing, efficient loading and an engaging concept. Replacing a font or hiding a placeholder cannot, by itself, resolve the artwork or gameplay-depth rating. The quality guidance criticizes reliance on generic assets; it does not establish a blanket prohibition on every AI-created asset.

## Changes against the reviewer's feedback

| Reviewer concern                     | Implemented cleanup                                                                                                                                                                                                                                                                                                                        | Remaining limitation                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poor bet UI                          | Consolidated the game layout into `src/game-world/presentation.css`. Direct bet entry and −/+ controls remain; the previously removed preset row stays removed. Controls use quieter dark surfaces, a single prominent Fly action, readable labels and larger touch targets. Invalid amounts retain a visible explanation and disable Fly. | Verify permitted levels, currencies, feature-buy costs and jurisdiction settings on the connected platform. Browser simulation cannot establish physical-device usability.                                                                            |
| Low-quality or generic visual design | Removed the rendered placeholder hunter and its appearance selector while the replacement is drawn. Simplified result, settings, help and feature-route surfaces; reduced decorative gradients and conflicting global overrides. Existing scene art and source asset paths are preserved.                                                  | Manually drawn hunter artwork, coherent scene/creature/terrain treatment and documented artwork rights are still required. Existing raster files have not been independently certified as hand-drawn, AI-generated or licensed from appearance alone. |
| Font and icon concerns               | UI text uses locally hosted Google Sans; titles use locally hosted Cinzel. Official unmodified variable WOFF2 subsets, SIL Open Font License notices and a URL/size/SHA-256 manifest are included. No emoji controls were found in the inspected source.                                                                                   | Fonts are real typeface files, not generated lettering. A licensed font does not guarantee a distinctive visual identity or an improved reviewer score. Unsupported writing systems use installed fallback fonts.                                     |
| Poor animation and unclear hits      | Removed cosmetic HP/damage values and bars. A targeted authored hunter incident uses a short offscreen tracer, hit feedback and the existing shared-clock feather burst. Volleys are fixed by risk rather than cosmetic bird species. Existing staggered launch, damped formation, continuous scenery motion and cancellation remain.      | A subsequently reported Fluppy obstacle-contact defect is under repair; its final verification is pending below. Sustained frame rate and physical-device performance have not been measured in this task.                                            |
| Limited depth and weak Burst concept | Preserved the four-bird survivor presentation, Champion handoff and separate existing feature buys. Lineup choices are explicitly cosmetic; no aiming, health strategy, frontend collision outcome or extra Champion wager was introduced.                                                                                                 | Published live books remain legacy single-bird books. The live flock/Champion concept needs reviewed authoritative books and probabilities. Cosmetic choices cannot be counted as financial gameplay depth.                                           |

The result display continues to distinguish Champion failure with retained base winnings from actual bonus success. Entry cost, multiplier, payout and net result remain visible. The optional Fluppy round retains its own stake, while the main Lucky Flight bet preference remains preserved after completion and replay.

## Health and hunter boundary

`ActiveBird` no longer carries health or maximum-health fields, and `BirdHealth.svelte` is removed. Hunter attack planning has no species health or weapon damage input. At 1×, Safe presents one shot, Balanced two, and Danger three; each projectile travels for 160ms. Shot spacing is 160ms for Safe/Danger and 220ms for Balanced. The final impact aligns with the serial authored elimination commit. Playback speed affects presentation only.

No hunter body or weapon image is rendered in the current game. Original hunter/weapon paths and historical appearance metadata remain available for existing snapshots and the forthcoming replacement art. Offscreen shots illustrate explicitly authored hunter incidents; terrain, wind and predator incidents retain their own presentation mappings.

Help and localized operational/flock summaries no longer advertise HP or hunter appearance choices. Birds, time and launch style change appearance only. Server results determine live survival and payout.

## Release size and font provenance

`pnpm build` now runs `scripts/prune-release.mjs` after Vite. The cleanup removes only generated deployment copies of dormant WebM clips and the four old Google Sans TTFs. Source originals remain at their existing `static/` paths.

The script checks generated HTML, JavaScript, CSS and JSON before any deletion and fails if these dormant file types remain referenced. It rejects symbolic links and validates resolved deletion targets stay inside this app's `build/`. Six focused tests cover preservation of source files and active WOFF2 fonts, idempotence, runtime-reference guards, incomplete builds and linked directories.

| Measured files                                                                 |                        Size |
| ------------------------------------------------------------------------------ | --------------------------: |
| Twelve dormant original WebMs excluded from the release                        | 33,186,784 bytes / 31.65MiB |
| Four legacy TTFs excluded from the release                                     |   7,620,964 bytes / 7.27MiB |
| Seven active WOFF2 font subsets                                                |     172,576 bytes / 0.16MiB |
| Latest generated cleaned build inspected before the Fluppy repair was verified | 63,409,337 bytes / 60.47MiB |

These are filesystem/upload measurements, not initial network transfer, decode time, browser memory or a claimed Engine asset budget. Large retained scene/terrain images still contribute to the release. See [font sources and licenses](./art/fonts/README.md), `static/fonts/font-manifest.json` and [packaging instructions](./submission/README.md).

## Outcome and settlement boundaries

Source review found no changes to published math or `submission/math/` in this cleanup. Existing payout values, probabilities, bet limits, feature-buy entry costs, live play and settlement are preserved. The shared presentation timeline still cancels stale-round work; serial outcome commits and alive guards prevent eliminated birds from reappearing.

The 13 October audit verified 445,462 published books, lookup/payout consistency, 11 recorded hashes, 15 replay examples and exact weighted 96% RTP for the existing modes. That historical verification was not repeated by this documentation pass. It also found **zero `elimination` or `championFlight` events** in the published books. The new live flock envelope must be reviewed and supplied by server books rather than inferred from a legacy payout.

Champion remains part of one authored paid round, with one final settlement and no second play request. A failed Champion retains the banked base win defined by the authoritative result.

The existing half-net-profit Fluppy offer depends on an earlier win and remains development-only. Do not enable that continuation in production: the approval guidelines require independent wagers and prohibit continuation/gamble mechanics. Presentation cleanup does not remove this restriction.

## Verification checkpoint before the Fluppy repair

The root implementation run reported:

- **98 tests passed**, including the fixed-volley/HP-removal coverage and six release-pruning tests.
- ESLint passed.
- Svelte check returned **0 errors and 0 warnings**.
- Production build, including release pruning, passed.

The integration review found no material cancellation, incident-commit, payout or pruning regression in that checkpoint. The shared animation loop, bitmap caches and bounded sprite decoding remain in place. This is source/test evidence; sustained 60Hz, actual GPU memory and frame timing are not claimed.

The historical 13 October browser audit checked local demo layouts at 320×740, 390×844, 768×1024, 1280×800 and 680×360. It exercised invalid bet entry, manual amount stepping, feature cost labels, a flock loss/history replay, fractional win-counter stability and bet restoration after Fluppy. Those checks apply to that earlier version and are not presented as fresh verification of this redesign. Current browser checks should be recorded here after the root completes them.

## Fluppy contact regression — final verification pending

The user subsequently reported that birds can visibly touch the original Fluppy obstacles without bursting. Read-only analysis found two presentation mismatches:

1. Legacy single-bird routes were using the four-bird formation's minimum-Y clamp. An upper crash target could not be reached; an authored successful opening above the clamp could visibly intersect lower terrain.
2. Crash timing used the narrow gate anchor while the painted terrain extended beyond it. The gate was removed immediately when its resolver completed, before the outer burst presentation began.

The repair must align single-bird movement and the visible incident with the recorded gate result. **An authored pass must remain a pass; frontend contact must not decide a new gambling outcome.** Meaningful coverage should simulate successful openings and upper/lower crashes at mobile and desktop sizes, verify one burst, and preserve cancellation/replay/final payout behavior. Existing action tests previously stubbed `presentGate`, so they did not exercise this real approach geometry.

Final Fluppy test, lint, Svelte-check, build and browser evidence are **pending root verification**. The 98-test checkpoint above must not be described as validating that later repair.

## Remaining release work

1. **Finish manual artwork and verify provenance.** Replace the temporary hunter absence with the user's art when ready; inspect the complete scene, creatures, terrain and effects for a coherent visual style. Document rights/source provenance for all release artwork and sound. No new raster artwork was generated in this cleanup.
2. **Review and publish authoritative flock/Champion math.** Validate the versioned event envelope, survivor schedule, Champion success/failure, probabilities and final payout together. The current frontend cannot turn legacy books into live flock outcomes.
3. **Keep optional wagers independent in production.** Retain the demo-only restriction on the win-dependent Fluppy offer. Existing independent feature buys and same-round Champion behavior remain separate.
4. **Finish localization and jurisdiction QA.** Some gameplay/rules copy remains English; social authentication/replay is not ready for Stake-US. Check restricted wording and platform options against the [jurisdiction requirements](https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements).
5. **Test real devices and the connected platform.** Check iOS/Safari, Android, low-memory devices, popout, sustained rendering/loading, large balances and currencies. Exercise ACP/CDN play, recovery, public replay and settlement with each mode's loss, win, maximum and bonus cases. No live-platform approval, physical-device or network-performance pass is claimed here.

Resubmission should use the finalized frontend and reviewed math version. This cleanup improves clarity and presentation; approval and the eventual quality score remain the reviewer's decision.
