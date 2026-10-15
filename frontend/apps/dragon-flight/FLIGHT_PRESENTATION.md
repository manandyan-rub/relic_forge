# Flight presentation

`flock/director.ts` maps authored events into an ordered timeline. `flock/timeline.ts` is driven by the world's sole requestAnimationFrame loop. Milliseconds describe presentation only; payouts, probabilities, books and server settlement are unchanged.

At 1x launch takes 800ms (100ms bird stagger), ordinary events 400–800ms, non-hunter eliminations 720ms, and hunter volleys 600–763ms. Every hunter projectile travels for 160ms independently of bird species; rifle shot spacing is 220ms and Glock/AK spacing is 160ms. Playback speed scales these presentation times once. Continuous travel bridges bring short base books to 7–10.5 seconds without stretching individual hazards. Longer books retain readable events. Champion adds 5.05 seconds for a failure or 6.15 seconds for a successful landing. A 450ms result tail leaves impact effects time to finish. Network settlement may add time.

## Authoritative mapping

- Gate artwork follows its hazard: cliff/mountain gaps and forest passages use existing terrain assets; windPass uses the wind system.
- Current events preserve their currentType; encounter events preserve their encounterType and result.
- Eliminations preserve their explicit reason and bird. Hunter aims and shoots only for an explicit hunter elimination. Terrain/wind/predator eliminations never become hunter attacks.
- Legacy elimination records lack a hazard subtype. The documented cosmetic fallback is cliffGap for terrain, crosswind for wind and ridgeDragon for predator. These choices do not modify the authored survival result.
- The existing demo adapter explicitly authors hunter elimination reasons. This pass does not change that adapter or its calibrated outcomes. Its gates now show their original terrain/wind hazards instead of additional missed gunshots.
- Champion keeps the same paid round and Archaeopteryx body; other birds leave while the existing storm artwork crossfades in. Bonus failure displays BASE WIN RETAINED; bonus success displays the actual additive bonus amount.

## Rendering and safety

One clock scales presentation time once. Hidden tabs discard elapsed gaps; resumed frames are clamped to 50ms before scaling. Cancellation invalidates all pending clock jobs, including sibling effects cancelled from a frame callback. Live responses and decoded scenes have stale/disposal guards. Concurrent settlement shares one request; replay skips paid play and settlement.

Background artwork stays fixed at the user's request, without camera drift or a moving foreground copy. Birds, hazards and weather effects continue animating. Formation springs preserve position and velocity during elimination/handoff, normalize coordinates during resize and use separate flap phases. Decoded sprite frames and scene promises are reused. Sprite, terrain, floor, particle and progress motion use transforms; canvas redraws occur only when the decoded frame changes. Rain uses transformed tiled layers; lightning follows the shared scroll clock rather than random timers.

Sprite bitmap decoding is bounded to 450px wide with two concurrent decodes globally, preserving aspect ratio and cached reuse. From the 33 source WebP dimensions, retained RGBA allocation is approximately 18MiB instead of 803MiB. This is a calculated estimate, not measured process memory. Initial preview positions reserve HUD space, and event callouts sit below the multiplier rather than behind the status chips.

Runtime video playback is removed from both bird eliminations and legacy dragon encounters. BirdBurst is a deterministic feather effect driven by elimination age or a cancellable 650ms timeline job; it has no timers, media callbacks, or independent animation loop. Legacy dragon encounters use the existing in-world sprite and enter/engage/resolve presentation, preserving authored outcomes. The twelve original WebM files and artwork paths remain intact for future manual replacements but are not requested by gameplay. This avoids approximately 31.65MiB of video downloads, decoder stalls, and full-screen scene replacement; the generated release now excludes those dormant clips while source originals remain intact.

Local Node measurement of the warmed four-bird motion kernel over 10,000 ticks: median 0.00093ms and p95 0.00417ms per tick. This excludes Svelte, canvas, video decode and browser compositing; it is not a measured 60fps claim. Browser tools do not expose frame-timing instrumentation here.

## Custom four-bird lineups

Customize includes a species selector for each of the four slots. Duplicates are allowed, including four of the same species. Stable authored slot IDs remain separate from cosmetic species: an elimination affects exactly one slot, with the selected bird's animation and burst artwork. The chosen tuple is copied into the round for session history/replay. Lineups do not enter outcome generation, payout math or Stake play parameters. Legacy single-bird feature routes remain unchanged; Champion uses Archaeopteryx in its existing leader slot.

## Mobile hunt presentation

Adapted from `D:/lucky-flight-mobile`, without a runtime dependency on that project:

- The existing placeholder hunter and guns remain visible until custom drawings are ready, as requested. Safe uses Glock 17, Balanced uses Trail Rifle and Danger uses AK-47. Original asset paths and hunter metadata remain compatible. Explicit hunter eliminations use targeted bullets and impact flashes. The truck remains removed.
- Numeric HP/damage and health bars were removed. Safe/Balanced/Danger illustrate one/two/three shots with fixed risk-specific timing. Cosmetic bird choices never change incident length, odds or payout. Only the authored timeline commit can eliminate a slot. Terrain, wind and predator incidents retain their own cause.
- Mobile species motion is adapted at smaller amplitudes to preserve formation readability. The shared casino frame clock drives impact flashes, trajectories and bird movement; no additional animation loop or collision engine is introduced. Mobile birds remain below the compact status/multiplier row.
- Old hunter metadata remains accepted for existing replay snapshots. Customize offers lineup, time and launch presentation. Champion preserves leader position and velocity, reframes onto Archaeopteryx and never revives an eliminated slot.
- Google Sans UI and Cinzel titles use verified official OFL fonts hosted locally as compact WOFF2 subsets. Licenses and provenance are recorded under art/fonts and static/fonts. A single presentation.css replaces the stacked world/control overrides; dialogs keep their own borders and focus styles. Numeric payout width and original hunter-bet preservation remain intact.

Not imported: mobile manual aim/shoot/reload controls, hitbox physics, armor upgrades, bird counterattacks, hunter/house damage, coins, shops, progression, score or stars. They affect arcade outcomes and would need separate authored casino mathematics before they could affect survival or payouts. No Stake calls, published books, probabilities, RTP, entry costs, feature-buy logic or optional wager rules changed.
