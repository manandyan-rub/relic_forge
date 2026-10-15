<script lang="ts">
	import type { CreatureProfile, FlightRound } from '../types';
	let {
		round,
		creature,
		title,
		entryCost,
		multiplier,
		payout,
		netResult,
		weatherName,
		timeName,
		live,
		replay,
		disabled,
		settingsDisabled,
		onSettings,
		tubeAmount,
		tubeReason = '',
		onTubeFlight,
	}: {
		round: FlightRound;
		creature: CreatureProfile;
		title: string;
		entryCost: string;
		multiplier: number;
		payout: string;
		netResult: string;
		weatherName: string;
		timeName: string;
		live: boolean;
		replay: boolean;
		disabled: boolean;
		settingsDisabled: boolean;
		onSettings: () => void;
		tubeAmount?: string;
		tubeReason?: string;
		onTubeFlight: () => void;
	} = $props();
	const netLoss = $derived(round.finalWin < (round.entryCost ?? round.bet));
</script>

<section class="flight-result" aria-label="Flight result" aria-live="polite">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable details need keyboard focus for native Arrow and Page key navigation.) -->
	<div class="result-summary" role="region" aria-label="Round details" tabindex="0">
		<header>
			<h2>{title}</h2>
			<span>{round.flock ? `${round.flock.survivors}/4 SURVIVED` : creature.name}</span>
		</header>
		<div class="result-stats">
			<div class="payout"><span>PAYOUT</span><strong>{payout}</strong></div>
			<div><span>ENTRY COST</span><strong>{entryCost}</strong></div>
			<div><span>MULTIPLIER</span><strong>×{multiplier.toFixed(2)}</strong></div>
			<div><span>NET RESULT</span><strong class:negative={netLoss}>{netResult}</strong></div>
		</div>
		{#if round.flock?.bonusTriggered}<p class="details bonus-breakdown">
				BASE ×{round.flock.baseMultiplier.toFixed(2)} · BONUS +×{round.flock.bonus!.multiplier.toFixed(
					2,
				)}
			</p>{/if}
		<p class="details">
			{round.route === 'tube-flight' ? 'FLUPPY FLIGHT · ' : ''}{weatherName} · {timeName}<span
				>{replay ? 'REPLAY — NO BET PLACED' : live ? 'SERVER RESULT' : 'DEMO — NO REAL MONEY'}</span
			>
		</p>
	</div>
	<div class="result-actions">
		{#if tubeAmount}<button
				class="fluppy-button"
				disabled={disabled || Boolean(tubeReason)}
				onclick={onTubeFlight}>PLAY FLUPPY FLIGHT · {tubeAmount}</button
			>{/if}
		<button class="settings-button" disabled={settingsDisabled} onclick={onSettings}
			>{round.route === 'tube-flight' ? 'RETURN TO LUCKY FLIGHT' : 'CHANGE SETTINGS'}</button
		>
	</div>
	{#if tubeAmount}<p class="offer-note">
			{tubeReason || 'One attempt · half your net profit'}
		</p>{/if}
</section>

<style>
	.flight-result {
		display: flex;
		flex-direction: column;
		position: absolute;
		z-index: 100;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -35%);
		width: min(650px, calc(100% - 32px));
		max-height: calc(100% - 110px);
		overflow: hidden;
		scrollbar-width: thin;
		padding: 20px;
		border: 1px solid #bda16c80;
		border-radius: 14px;
		background: #0c1a24f5;
		color: #f2eee3;
		font-family: var(--font-ui);
		box-shadow: 0 12px 30px #07121d55;
	}
	.result-summary {
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	h2 {
		margin: 0;
		color: #f0d49b;
		font: 600 clamp(1rem, 2vw, 1.35rem) / 1.35 var(--font-display);
	}
	header span {
		flex-shrink: 0;
		padding: 6px 8px;
		border-radius: 7px;
		background: #25333b;
		color: #e9d7b3;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.result-stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.result-stats div {
		display: grid;
		gap: 7px;
		padding: 13px 8px;
		border: 1px solid #43525a;
		border-radius: 9px;
		background: #10212a;
	}
	.result-stats .payout {
		border-color: #d4b37480;
		background: #283239;
	}
	.result-stats span {
		color: #bfbdaf;
		font-size: 0.6875rem;
		font-weight: 600;
	}
	strong {
		color: #fff0d0;
		font-size: 1.125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.negative {
		color: #ffc0aa;
	}
	.details {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 5px 8px;
		margin: 12px 0;
		color: #bdc8ce;
		font-size: 0.75rem;
		line-height: 1.45;
	}
	.details span {
		color: #a0b2bb;
		font-size: 0.6875rem;
	}
	.bonus-breakdown {
		padding: 10px;
		border-left: 2px solid #dfc18c;
		background: #172b34;
		color: #f0d49b;
	}
	.result-actions {
		display: flex;
		flex-shrink: 0;
		margin-top: 12px;
		gap: 10px;
	}
	button {
		flex: 1;
		min-height: 46px;
		padding: 10px;
		border: 1px solid #64727a;
		border-radius: 9px;
		background: #152832;
		color: #f0d49b;
		cursor: pointer;
		font: 600 0.8125rem/1.3 var(--font-ui);
	}
	.fluppy-button {
		border-color: #f1d49b;
		background: #e4bd73;
		color: #2a2318;
	}
	button:hover:not(:disabled) {
		background: #233d48;
	}
	.fluppy-button:hover:not(:disabled) {
		background: #f2d498;
	}
	button:disabled {
		opacity: 0.48;
		cursor: not-allowed;
	}
	.offer-note {
		flex-shrink: 0;
		margin: 10px 0 0;
		color: #bdc8ce;
		font-size: 0.6875rem;
		line-height: 1.4;
		text-align: center;
	}
	@media (max-width: 700px) {
		.flight-result {
			top: 112px;
			bottom: 12px;
			transform: translateX(-50%);
			width: calc(100% - 24px);
			max-height: none;
			padding: 12px;
			border-radius: 12px;
		}
		header {
			gap: 8px;
			margin-bottom: 12px;
		}
		h2 {
			font-size: 0.95rem;
		}
		header span {
			font-size: 0.6875rem;
			padding: 5px 6px;
		}
		.result-stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 7px;
		}
		.result-stats div {
			padding: 10px;
			gap: 4px;
		}
		strong {
			font-size: 1rem;
		}
		.result-actions {
			flex-direction: column;
			gap: 8px;
		}
	}
</style>
