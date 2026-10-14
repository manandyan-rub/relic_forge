# Flight presentation

`flock/director.ts` maps authored events into an ordered timeline. `flock/timeline.ts` is driven by the world's sole requestAnimationFrame loop. Milliseconds describe presentation only; payouts, probabilities, books and server settlement are unchanged.

At 1x launch takes 800ms (100ms bird stagger), ordinary events 400–800ms, non-hunter eliminations 720ms, and hunter volleys 600–974ms. Every hunter projectile travels for 160ms regardless of bird health; rifle shot spacing is 220ms and Glock/AK spacing is 160ms. Playback speed scales these presentation times once. Continuous travel bridges bring short base books to 7–10.5 seconds without stretching individual hazards. Longer books retain readable events. Champion adds 5.05 seconds for a failure or 6.15 seconds for a successful landing. A 450ms result tail leaves impact effects time to finish. Network settlement may add time.

## Authoritative mapping

- Gate artwork follows its hazard: cliff/mountain gaps and forest passages use existing terrain assets; windPass uses the wind system.
- Current events preserve their currentType; encounter events preserve their encounterType and result.
- Eliminations preserve their explicit reason and bird. Hunter aims and shoots only for an explicit hunter elimination. Terrain/wind/predator eliminations never become hunter attacks.
- Legacy elimination records lack a hazard subtype. The documented cosmetic fallback is cliffGap for terrain, crosswind for wind and ridgeDragon for predator. These choices do not modify the authored survival result.
- The existing demo adapter explicitly authors hunter elimination reasons. This pass does not change that adapter or its calibrated outcomes. Its gates now show their original terrain/wind hazards instead of additional missed gunshots.
- Champion keeps the same paid round and Archaeopteryx body; other birds leave while the existing storm artwork crossfades in. Bonus failure displays BASE WIN RETAINED; bonus success displays the actual additive bonus amount.

## Rendering and safety

One clock scales presentation time once. Hidden tabs discard elapsed gaps; resumed frames are clamped to 50ms before scaling. Cancellation invalidates all pending clock jobs, including sibling effects cancelled from a frame callback. Live responses and decoded scenes have stale/disposal guards. Concurrent settlement shares one request; replay skips paid play and settlement.

Formation springs preserve position and velocity during elimination/handoff, normalize coordinates during resize and use separate flap phases. Decoded sprite frames and scene promises are reused. Sprite, terrain, floor, particle and progress motion use transforms; canvas redraws occur only when the decoded frame changes. Rain uses transformed tiled layers; lightning follows the shared scroll clock rather than random timers.

Sprite bitmap decoding is bounded to 450px wide with two concurrent decodes globally, preserving aspect ratio and cached reuse. From the 33 source WebP dimensions, retained RGBA allocation is approximately 18MiB instead of 803MiB. This is a calculated estimate, not measured process memory. Initial preview positions reserve HUD space, and event callouts sit below the multiplier rather than behind the status chips.

Runtime video playback is removed from both bird eliminations and legacy dragon encounters. BirdBurst is a deterministic feather effect driven by elimination age or a cancellable 650ms timeline job; it has no timers, media callbacks, or independent animation loop. Legacy dragon encounters use the existing in-world sprite and enter/engage/resolve presentation, preserving authored outcomes. The twelve original WebM files and artwork paths remain intact for future manual replacements but are not requested by gameplay. This avoids approximately 31.65MiB of video downloads, decoder stalls, and full-screen scene replacement; the production upload still contains the preserved source clips.

Local Node measurement of the warmed four-bird motion kernel over 10,000 ticks: median 0.00093ms and p95 0.00417ms per tick. This excludes Svelte, canvas, video decode and browser compositing; it is not a measured 60fps claim. Browser tools do not expose frame-timing instrumentation here.

## Custom four-bird lineups

Customize includes a species selector for each of the four slots. Duplicates are allowed, including four of the same species. Stable authored slot IDs remain separate from cosmetic species: an elimination affects exactly one slot, with the selected bird's animation and burst artwork. The chosen tuple is copied into the round for session history/replay. Lineups do not enter outcome generation, payout math or Stake play parameters. Legacy single-bird feature routes remain unchanged; Champion uses Archaeopteryx in its existing leader slot.

## Mobile hunt presentation

Adapted from `D:/lucky-flight-mobile`, without a runtime dependency on that project:

- Original Forest Hunter/Mountain Ranger bodies and the Glock 17, Trail Rifle and AK-47 artwork are copied into `static/hunters`. Safe/Balanced/Danger choose those weapons respectively. The truck/driver are removed. The main flock uses one cover landscape, gentle camera pan, and no road or duplicate foreground image. The background files were already identical to the mobile project, so they are reused in place. Legacy single-bird/Fluppy and feature-buy scenes retain their existing presentation.
- Species health starts at Woodpecker 50, Azure Swift 60, Eagle 85 and Archaeopteryx 100. HP is a presentation value, not an added survival probability. An explicit `hunter` elimination becomes a deterministic volley, with intermediate HP changes and hit flashes; only its timeline commit can set HP to zero and eliminate the slot. Terrain, wind and predator incidents retain their own cause and do not become gun hits. Surviving birds keep their health. Duplicate species have independent slots.
- Mobile species motion is adapted at smaller amplitudes to preserve formation readability. The shared casino frame clock drives health flashes, trajectories and bird movement; no additional animation loop or collision engine is introduced.
- Hunter appearance is selectable in Customize, locked while flying, and snapshotted with each local flock round for replay. A Champion handoff resets the chosen leader's presentation to Archaeopteryx with 100 HP; it preserves position/velocity and never revives an eliminated slot.
- Shot sound is synthesized, as in the mobile project, with distinct pistol/rifle/automatic tone and a playback-speed-scaled envelope. It belongs to the existing cancellable audio lifecycle.

Not imported: mobile manual aim/shoot/reload controls, hitbox physics, armor upgrades, bird counterattacks, hunter/house damage, coins, shops, progression, score or stars. They affect arcade outcomes and would need separate authored casino mathematics before they could affect survival or payouts. No Stake calls, published books, probabilities, RTP, entry costs, feature-buy logic or optional wager rules changed.
