<script lang="ts">
	import FlightDialog from './FlightDialog.svelte';
	import type { FlightRound } from '../types';
	import { getBonusFlight } from '../bonusFlights';
	import { formatLocalAmount as formatAmount } from '../utils/format';
	import { t } from '../i18n';
	function formatLocalAmount(value: number) {
		return formatAmount(value, currency);
	}
	let {
		currency = 'USD',
		open,
		rounds,
		disabled,
		onClose,
		onReplay,
	}: {
		currency?: string;
		open: boolean;
		rounds: FlightRound[];
		disabled: boolean;
		onClose: () => void;
		onReplay: (round: FlightRound) => void;
	} = $props();
</script>

<FlightDialog {open} title={t('history')} {onClose}>
	<p>
		Your last 20 completed flights in this session. Replays show the same result and cost nothing.
	</p>
	{#if !rounds.length}<p class="empty">{t('history')}</p>{/if}
	<ol>
		{#each rounds as round (round.id)}
			{@const cost = round.entryCost ?? round.bet}
			<li>
				<div class="row">
					<strong
						>{round.bonusFlight
							? getBonusFlight(round.bonusFlight).name
							: `${round.route === 'tube-flight' ? 'FLUPPY FLIGHT · ' : ''}${round.risk.toUpperCase()} flight`}</strong
					><span>#{round.id}</span>
				</div>
				<dl>
					<div>
						<dt>{t('entryCost')}</dt>
						<dd>{formatLocalAmount(cost)}</dd>
					</div>
					<div>
						<dt>{t('payout')}</dt>
						<dd>{formatLocalAmount(round.finalWin)}</dd>
					</div>
					<div>
						<dt>{t('netResult')}</dt>
						<dd>{formatLocalAmount(round.finalWin - cost)}</dd>
					</div>
					<div>
						<dt>{t('multiplier')}</dt>
						<dd>{round.finalMultiplier}×</dd>
					</div>
				</dl>
				{#if round.flock}<p>
						{round.flock.survivors}/4 survived · {round.flock.bonusTriggered
							? 'Champion Flight'
							: 'Normal flight'}
					</p>{/if}
				<div class="actions">
					<button type="button" {disabled} onclick={() => onReplay(round)}
						>{t('playReplay')} #{round.id} · {t('replayNoCost')}</button
					>
				</div>
			</li>
		{/each}
	</ol>
</FlightDialog>

<style>
	p {
		color: #b6cccb;
		font: 0.85rem/1.5 var(--font-ui);
		margin-top: 0;
	}
	.empty {
		padding: 32px 0;
		text-align: center;
	}
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
	}
	li {
		display: grid;
		gap: 16px;
		border: 1px solid #4e6d70;
		border-radius: 12px;
		padding: 18px;
		font: 0.8rem var(--font-ui);
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
	}
	dt {
		font-size: 0.68rem;
		color: #b6cccb;
		margin-bottom: 5px;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		padding-top: 14px;
		border-top: 1px solid #385457;
	}
	button {
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid #699087;
		border-radius: 7px;
		background: #173a35;
		color: #d8eee7;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 2px solid #80edc9;
		outline-offset: 3px;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	@media (max-width: 480px) {
		dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
