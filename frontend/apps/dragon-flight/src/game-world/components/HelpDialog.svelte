<script lang="ts">
	import { CREATURES } from '../creatures';
	import { FLIGHT_STAGES } from '../stages';
	import { WEATHER_OPTIONS } from '../weather';
	import { TIME_OF_DAY_OPTIONS } from '../timeOfDay';
	import { LAUNCH_OPTIONS } from '../config';
	import payouts from '../payouts.json';
	import { language, t } from '../i18n';
	import { operationalRules, flockSummary } from '../operatingRules';
	import {
		PICKUP_LABELS,
		CURRENT_LABELS,
		ENCOUNTER_LABELS,
		HAZARD_LABELS,
		ENDING_LABELS,
	} from '../presentation';
	type Props = {
		open: boolean;
		live?: boolean;
		onClose: () => void;
	};

	let { open, onClose, live = false }: Props = $props();
	let dialogElement = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialogElement) return;

		if (open && !dialogElement.open) {
			dialogElement.showModal();
		} else if (!open && dialogElement.open) {
			dialogElement.close();
		}
	});

	function requestClose() {
		if (dialogElement?.open) {
			dialogElement.close();
		} else {
			onClose();
		}
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		requestClose();
	}

	function handleWindowClick(event: MouseEvent) {
		if (open && event.target === dialogElement) requestClose();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<dialog
	bind:this={dialogElement}
	class="help-dialog"
	aria-labelledby="dragon-flight-help-title"
	aria-describedby="dragon-flight-help-summary"
	oncancel={handleCancel}
	onclose={onClose}
>
	<div class="help-panel">
		<header class="help-header">
			<div>
				<p class="help-kicker">LUCKY FLIGHT</p>
				<h2 id="dragon-flight-help-title">{t('guide')}</h2>
				<p id="dragon-flight-help-summary">Fly through mountains, forests and open skies.</p>
			</div>
			<button
				class="close-button"
				type="button"
				aria-label="Close game guide"
				data-audio-panel
				onclick={requestClose}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
			</button>
		</header>

		<div class="help-content">
			{#if language !== 'en'}
				<section class="localized-guide">
					<h3>{t('guide').toUpperCase()}</h3>
					<p>{flockSummary[language]}</p>
					{#if live}
						<div class="localized-payouts">
							{#each payouts as mode (mode.id)}
								<p>
									<strong>{mode.name}</strong> · {mode.cost}× {t('bet')} · {t('multiplier')}: 0×–{mode.multipliers.at(
										-1,
									)}×
								</p>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
			<section aria-labelledby="help-operating-rules">
				<h3 id="help-operating-rules">{t('gameConditions')}</h3>
				<p>{operationalRules[language]}</p>
			</section>
			<section aria-labelledby="help-play">
				<h3 id="help-play">YOUR FLIGHT</h3>
				<ol>
					<li>Set your bet.</li>
					<li>Choose Safe, Balanced or Danger.</li>
					<li>Choose your bird lineup, time and launch in Customize.</li>
					<li>
						Press <strong>FLY</strong> to launch the flight. The local demo uses four birds; connected
						play follows the server book, which may use one bird. Space also starts a flight when permitted
						and no menu or control has focus.
					</li>
					<li>
						See your result. Press Fly for another round, or Change Settings to adjust your setup.
					</li>
				</ol>
				<p>
					Watch the survivor icons as the flock passes hazards and rides currents. Each incident
					shows the recorded round outcome; there is no aiming or action that changes the payout. An
					eliminated bird fades out and its survivor icon becomes inactive. If all four reach the
					destination, Archaeopteryx continues alone in Champion Flight within the same paid round.
					No extra bet is charged. A Champion crash keeps the normal flight payout. Existing
					feature-buy routes and older server books can present a single bird.
				</p>
			</section>

			<section aria-labelledby="help-creatures">
				<h3 id="help-creatures">CREATURES</h3>
				<div class="guide-grid creature-grid">
					{#each CREATURES as creature (creature.id)}
						<article class="guide-card">
							<strong>{creature.name}</strong><span>{creature.description}</span>
						</article>
					{/each}
				</div>
				<p class="note">
					Customize lets you choose any four birds, including duplicates. Bird choices, flight
					movement, weather, time and launch style only change appearance. They do not change the
					odds or payouts. Outcomes are determined before the animation; connected play uses the
					server result.
				</p>
			</section>

			<section aria-labelledby="help-bet">
				<h3 id="help-bet">BET &amp; RISK</h3>
				<p>
					Choose your base bet from the available amounts. Connected play uses the wallet’s
					permitted bet levels, or its minimum, maximum and wager step.
				</p>
				<div class="guide-grid three-grid">
					<article class="guide-card">
						<strong>SAFE</strong><span
							>Shorter flights, fewer crashes and smaller potential rewards.</span
						>
					</article>
					<article class="guide-card">
						<strong>BALANCED</strong><span>Medium risk and reward potential.</span>
					</article>
					<article class="guide-card">
						<strong>DANGER</strong><span
							>More crashes, with longer flights and larger rewards possible.</span
						>
					</article>
				</div>
				<div class="formula">Final win = bet × final multiplier</div>
				<p class="note">
					An empty flock pays ×0. The payout uses the recorded round multiplier, independently of
					how many birds survive. Final multiplier = base + Champion bonus. Setup stays locked until
					you choose Change Settings.
				</p>
			</section>

			{#if live}
				<section aria-labelledby="help-payouts">
					<h3 id="help-payouts">PAYOUT REFERENCE</h3>
					<p>
						Every mode has a theoretical RTP of 96% of its entry cost over many rounds. This does
						not predict an individual result. All payouts below multiply the base bet, not the bonus
						entry cost.
					</p>
					{#each payouts as mode (mode.id)}
						<details class="payout-reference">
							<summary
								>{mode.name} · {mode.cost}× entry · maximum {mode.multipliers.at(-1)}× base bet</summary
							>
							<p>
								Possible final payout multipliers: {mode.multipliers
									.map((value) => `${value}×`)
									.join(', ')}.
							</p>
						</details>
					{/each}
					<p>
						Pickups and currents show potential rewards, not separate payments. Only the final
						payout is paid. Losing the base flight pays zero. If the server book includes Champion
						Flight, its failure retains the banked base win. Interruptions do not create a new
						outcome; reconnect to recover the server round.
					</p>
				</section>
			{/if}
			<section aria-labelledby="help-landscapes">
				<h3 id="help-landscapes">LANDSCAPES</h3>
				<p>{FLIGHT_STAGES.map((stage) => stage.name).join(' → ')}</p>
				<p class="note">The landscapes you reach depend on how the flight unfolds.</p>
			</section>

			<section aria-labelledby="help-customize">
				<h3 id="help-customize">CUSTOMIZE</h3>
				<p>
					Risk sets the weather: Safe uses Clear and Day, Balanced uses Rain, and Danger uses Storm.
					Customize changes the birds, time (outside Safe) and launch animation. These choices do
					not change odds or payouts. Reset defaults restores the original lineup, Day and Glide
					while keeping the selected risk.
				</p>
				<div class="guide-grid three-grid">
					{#each TIME_OF_DAY_OPTIONS as option (option.id)}
						<article class="guide-card">
							<strong>{option.name}</strong><span>{option.description}</span>
						</article>
					{/each}
					{#each WEATHER_OPTIONS as option (option.id)}
						<article class="guide-card">
							<strong>{option.name}</strong><span>{option.description}</span>
						</article>
					{/each}
					{#each LAUNCH_OPTIONS as option (option.id)}
						<article class="guide-card">
							<strong>{option.name}</strong><span>{option.note}</span>
						</article>
					{/each}
				</div>
			</section>

			<section aria-labelledby="help-events">
				<h3 id="help-events">ALONG THE WAY</h3>
				<div class="event-groups">
					<div>
						<strong>OBSTACLES</strong><span>{Object.values(HAZARD_LABELS).join(' · ')}</span>
					</div>
					<div><strong>PICKUPS</strong><span>{Object.values(PICKUP_LABELS).join(' · ')}</span></div>
					<div>
						<strong>AIR CURRENTS</strong><span>{Object.values(CURRENT_LABELS).join(' · ')}</span>
					</div>
					<div>
						<strong>PREDATOR ENCOUNTERS</strong><span
							>{Object.values(ENCOUNTER_LABELS).join(' · ')}</span
						>
					</div>
				</div>
				<p>
					Pickups, currents and successful encounters can increase the displayed multiplier. The
					final result determines your win.
				</p>
			</section>

			<section aria-labelledby="help-endings">
				<h3 id="help-endings">FLIGHT ENDINGS</h3>
				<p>{Object.values(ENDING_LABELS).join(' · ')}</p>
				<p>
					Successful flights finish at outdoor landing spots, from an open meadow to a secluded
					valley or high summit.
				</p>
			</section>

			<section aria-labelledby="help-info">
				<h3>BONUS FLIGHTS &amp; REPLAYS</h3>
				<p>
					Bonus Flights offers two direct-entry routes: Storm Run costs 20× your base bet and Summit
					Expedition costs 50×. Open Payouts &amp; chances in the route menu to see every possible
					result. A purchased flight can return zero; entry does not guarantee a payout. Risk
					settings apply to normal flights only.
				</p>
				<p>
					Bonus multipliers use the base bet. Results show the full entry cost, payout and net
					result. History keeps 20 completed flights for this session. Its Replay button shows a
					previous result at no cost. Fly Again or Buy Again starts a new independent flight at the
					displayed price.
				</p>
				<p>
					Choose Speed before a flight: 1× for a relaxed pace, 1.5× for the default faster playback,
					or 2× for a quick flight. Speed changes animation timing only, not odds or payouts.
				</p>
				<h3 id="help-info">GAME INFORMATION</h3>
				<p>
					{live
						? 'The server selects each result.'
						: 'This is a local demo with no real-money bets or wallet connection.'} Results are selected
					before the animation; timing and on-screen collisions do not determine payouts.
				</p>
				<p class="note">
					{live
						? 'Published single-bird books have theoretical RTP of 96% in each mode. Normal maximum payouts: Safe 20x, Balanced 100x, Danger 1000x base bet. Rewards shown during flight are potential until the final result. A Champion failure, when supplied by the server, retains the base win. There is no cashout or timing advantage.'
						: 'Demo risk settings are not certified RTP.'}
				</p>
			</section>
		</div>
	</div>
</dialog>

<style>
	.payout-reference {
		margin-bottom: 10px;
		padding: 12px;
		border: 1px solid #627e81;
		border-radius: 8px;
		font: 0.9rem/1.55 var(--font-ui);
	}
	.payout-reference summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.payout-reference p {
		margin-top: 10px;
		overflow-wrap: anywhere;
	}
	.help-dialog {
		box-sizing: border-box;
		width: min(780px, calc(100vw - 28px));
		max-height: min(88dvh, 920px);
		padding: 0;
		border: 1px solid #627e81;
		background: transparent;
		color: #dfe9e4;
		font-family: var(--font-ui);
		box-shadow:
			0 24px 80px rgba(0, 0, 0, 0.72),
			0 0 34px rgba(210, 148, 49, 0.18);
	}
	.help-dialog::backdrop {
		background: rgba(1, 6, 4, 0.78);
		backdrop-filter: blur(3px);
	}
	.help-panel {
		box-sizing: border-box;
		display: flex;
		max-height: min(88dvh - 2px, 918px);
		flex-direction: column;
		overflow: hidden;
		border: 4px solid #162a30;
		outline: 1px solid rgba(255, 203, 100, 0.4);
		background: linear-gradient(
			145deg,
			rgba(9, 35, 24, 0.99),
			rgba(7, 14, 10, 0.99) 65%,
			rgba(27, 12, 5, 0.99)
		);
	}
	.help-header {
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
		padding: 22px 24px 18px;
		border-bottom: 1px solid rgba(204, 151, 59, 0.55);
		background: linear-gradient(90deg, rgba(4, 20, 14, 0.92), rgba(37, 20, 7, 0.5));
	}
	.help-kicker {
		margin: 0 0 5px;
		color: #62e7a9;
		font: 700 0.8rem/1.3 var(--font-ui);
		letter-spacing: 0.2em;
	}
	.help-header h2 {
		margin: 0;
		color: #e4e9df;
		font: 600 clamp(1.25rem, 3vw, 1.8rem) / 1.25 var(--font-display);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.help-header p:last-child {
		margin: 8px 0 0;
		color: #aeb7a6;
		font: 0.85rem/1.45 var(--font-ui);
	}
	.close-button {
		display: grid;
		width: 44px;
		min-height: 44px;
		flex: 0 0 auto;
		place-items: center;
		padding: 0;
		box-sizing: border-box;
		border: 1px solid #b6812f;
		border-radius: 50%;
		background: rgba(4, 19, 13, 0.85);
		cursor: pointer;
		color: #e4e9df;
	}
	.close-button:focus-visible {
		outline: 2px solid #f0d58c;
		outline-offset: 3px;
	}
	.close-button svg {
		display: block;
		width: 21px;
		height: 21px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-width: 2;
	}
	.help-content {
		min-height: 0;
		overflow: auto;
		padding: 20px 24px 26px;
		scrollbar-color: #9d6c25 #08120d;
	}
	.help-content section {
		padding: 0 0 20px;
	}
	.localized-payouts {
		display: grid;
		gap: 6px;
		margin-top: 18px;
	}
	.localized-payouts p {
		margin: 0;
		padding: 9px 10px;
		border: 1px solid rgba(181, 130, 44, 0.4);
		background: rgba(3, 16, 11, 0.62);
	}
	.help-content section + section {
		padding-top: 20px;
		border-top: 1px solid rgba(201, 152, 63, 0.2);
	}
	.help-content h3 {
		margin: 0 0 10px;
		color: #f0c466;
		font: 700 0.88rem/1.3 var(--font-ui);
		letter-spacing: 0.08em;
	}
	.help-content p,
	.help-content li {
		color: #d3d7c8;
		font: 0.92rem/1.6 var(--font-ui);
	}
	.help-content p {
		margin: 0 0 9px;
	}
	.help-content ol {
		margin: 0;
		padding-left: 23px;
		columns: 2;
		column-gap: 34px;
	}
	.help-content li {
		break-inside: avoid;
		margin-bottom: 5px;
	}
	.help-content strong {
		color: #f8d684;
	}
	.guide-grid {
		display: grid;
		gap: 8px;
	}
	.creature-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.three-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.guide-card {
		min-height: 58px;
		padding: 10px 11px;
		border: 1px solid rgba(181, 130, 44, 0.4);
		background: rgba(3, 16, 11, 0.62);
	}
	.guide-card strong,
	.guide-card span {
		display: block;
	}
	.guide-card strong {
		font: 700 0.85rem/1.35 var(--font-ui);
		letter-spacing: 0.08em;
	}
	.guide-card span {
		margin-top: 5px;
		color: #abb9a9;
		font: 0.82rem/1.5 var(--font-ui);
	}
	.note {
		color: #a9bdc7;
		font-size: 0.82rem;
	}
	.formula {
		display: inline-block;
		margin: 2px 0 8px;
		padding: 9px 12px;
		border: 1px solid rgba(63, 216, 143, 0.5);
		background: rgba(8, 64, 40, 0.48);
		color: #70efb0;
		font: 600 0.9rem/1.4 var(--font-ui);
	}
	.event-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.event-groups > div {
		padding: 10px 11px;
		border-left: 2px solid #a66f24;
		background: rgba(3, 16, 11, 0.6);
	}
	.event-groups strong,
	.event-groups span {
		display: block;
	}
	.event-groups strong {
		color: #f4ce79;
		font: 700 0.8rem/1.3 var(--font-ui);
		letter-spacing: 0.1em;
	}
	.event-groups span {
		margin-top: 5px;
		color: #b4c0ad;
		font: 0.82rem/1.5 var(--font-ui);
	}

	@media (max-width: 620px) {
		.help-dialog {
			width: calc(100vw - 16px);
			max-height: calc(100dvh - 16px);
		}
		.help-panel {
			max-height: calc(100dvh - 18px);
		}
		.help-header {
			padding: 16px 15px 14px;
		}
		.help-content {
			padding: 16px 15px 22px;
		}
		.help-content ol {
			columns: 1;
		}
		.creature-grid,
		.three-grid,
		.event-groups {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.help-dialog::backdrop {
			backdrop-filter: none;
		}
	}
</style>
