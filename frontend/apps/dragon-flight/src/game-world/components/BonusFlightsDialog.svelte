<script lang="ts">
	import { base } from '$app/paths';
	import FlightDialog from './FlightDialog.svelte';
	import { BONUS_FLIGHTS, BONUS_TICKETS, getBonusFlight } from '../bonusFlights';
	import { formatLocalAmount as formatAmount } from '../utils/format';
	import type { BonusFlightId } from '../types';
	import { language, rulesSummary, t } from '../i18n';
	function formatLocalAmount(value: number) {
		return formatAmount(value, currency);
	}
	let {
		currency = 'USD',
		live = false,
		open,
		bet,
		disabled,
		onClose,
		onBuy,
	}: {
		currency?: string;
		live?: boolean;
		open: boolean;
		bet: number;
		disabled: boolean;
		onClose: () => void;
		onBuy: (id: BonusFlightId) => void;
	} = $props();
	let selected = $state<BonusFlightId>('storm-run');
	const feature = $derived(getBonusFlight(selected));
	const cost = $derived(bet * feature.costMultiplier);
</script>

<FlightDialog {open} title={t('bonusFlights')} {onClose}>
	<p class="intro">
		{language === 'en'
			? 'Choose your expedition. Entry guarantees the flight, not a payout.'
			: rulesSummary[language]}
	</p>
	<p class="base-bet">
		{t('bet')} <strong>{formatLocalAmount(bet)}</strong>
	</p>
	<fieldset {disabled}>
		<legend>{t('routes')}</legend>
		<div class="routes">
			{#each BONUS_FLIGHTS as route (route.id)}
				<label class:selected={selected === route.id}>
					<input type="radio" name="bonus-flight" value={route.id} bind:group={selected} />
					<img src={`${base || '.'}/bonuses/${route.id}.webp`} alt="" />
					<div class="caption">
						<span>{route.gateCount} · {route.costMultiplier}× {t('bet')}</span><strong
							>{route.name}</strong
						><b>{formatLocalAmount(bet * route.costMultiplier)} · {t('entryCost')}</b>
					</div>
				</label>
			{/each}
		</div>
	</fieldset>
	<p class="description">{feature.description}</p>
	<details>
		<summary>Payouts &amp; chances</summary>
		<p>
			Multipliers use the base bet. A payout below the entry cost is a net loss. Each flight draws
			one outcome independently.
		</p>
		<table>
			<thead
				><tr
					><th scope="col">{t('multiplier')}</th><th scope="col">{t('payout')}</th><th scope="col"
						>Chance</th
					></tr
				></thead
			>
			<tbody
				>{#each feature.outcomes as outcome (outcome.multiplier)}<tr
						><td>{outcome.multiplier}×</td><td>{formatLocalAmount(bet * outcome.multiplier)}</td><td
							>{(outcome.tickets / BONUS_TICKETS) * 100}%</td
						></tr
					>{/each}</tbody
			>
		</table>
		<p>
			96% theoretical return on entry cost over many flights. This does not predict an individual
			result.
		</p>
	</details>
	<div class="purchase">
		<div><span>{t('entryCost')}</span><strong>{formatLocalAmount(cost)}</strong></div>
		<button type="button" {disabled} onclick={() => onBuy(selected)}
			>{t('buyFlight')} · {formatLocalAmount(cost)}</button
		>
	</div>
	<p class="demo-note">
		{live
			? 'The full entry cost is charged when you buy.'
			: 'Local demo - No wallet or real-money purchase.'} Route weather is fixed; your appearance settings
		are kept for normal flights.
	</p>
</FlightDialog>

<style>
	p {
		font:
			400 0.85rem/1.5 system-ui,
			sans-serif;
		color: #becfce;
	}
	.intro {
		margin-top: 0;
	}
	.base-bet strong {
		color: #f1d58b;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 20px 0 0;
		min-width: 0;
	}
	legend {
		margin-bottom: 10px;
		font:
			650 0.8rem system-ui,
			sans-serif;
	}
	.routes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	label {
		position: relative;
		display: block;
		min-height: 240px;
		overflow: hidden;
		border: 2px solid #48636a;
		border-radius: 14px;
		cursor: pointer;
	}
	label.selected {
		border-color: #80edc9;
	}
	label:focus-within {
		outline: 2px solid #efcd80;
		outline-offset: 3px;
	}
	input {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 1;
		width: 20px;
		height: 20px;
		accent-color: #80edc9;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.caption {
		position: absolute;
		inset: auto 8px 8px;
		display: grid;
		gap: 7px;
		padding: 14px 12px;
		border-radius: 10px;
		background: #0b2225c7;
		backdrop-filter: blur(3px);
	}
	.caption span {
		font:
			650 0.6rem system-ui,
			sans-serif;
		letter-spacing: 0.08em;
		color: #a9d6ca;
	}
	.caption strong {
		font:
			750 1.2rem/1.15 system-ui,
			sans-serif;
	}
	.caption b {
		font:
			650 0.85rem system-ui,
			sans-serif;
		color: #ffe3a8;
	}
	details {
		border: 1px solid #496568;
		border-radius: 10px;
		padding: 12px;
		font-family: system-ui, sans-serif;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}
	th,
	td {
		text-align: left;
		padding: 8px 4px;
		border-bottom: 1px solid #385457;
	}
	.purchase {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		justify-content: space-between;
		position: sticky;
		bottom: -20px;
		margin: 16px -2px 0;
		padding: 14px 2px;
		background: #12272c;
	}
	.purchase div {
		display: grid;
		gap: 4px;
		font:
			600 0.75rem system-ui,
			sans-serif;
	}
	.purchase strong {
		font-size: 1.25rem;
		color: #ffe3a8;
	}
	button {
		min-height: 46px;
		padding: 12px 18px;
		border: 1px solid #87ebca;
		border-radius: 9px;
		background: #b8ead7;
		color: #102b29;
		font:
			750 0.8rem system-ui,
			sans-serif;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid #efcd80;
		outline-offset: 3px;
	}
	.demo-note {
		font-size: 0.72rem;
		margin-bottom: 0;
	}
	@media (max-width: 520px) {
		.routes {
			grid-template-columns: 1fr;
		}
		label {
			min-height: 205px;
		}
		.purchase {
			bottom: -12px;
		}
		.purchase button {
			flex: 1;
		}
	}
</style>
