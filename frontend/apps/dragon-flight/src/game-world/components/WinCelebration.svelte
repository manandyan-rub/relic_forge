<script lang="ts">
	import type { WinTier } from '../types';
	import { t } from '../i18n';

	type Props = {
		tier: WinTier;
		multiplier: string;
		win: string;
		targetWin: string;
	};

	let { tier, multiplier, win, targetWin }: Props = $props();
</script>

<div class={`win-celebration ${tier.id}`} aria-live="polite">
	<div class="sparkles" aria-hidden="true">
		{#each Array(30) as _, index (index)}
			<i style={`--i:${index};--x:${(index * 37) % 100}%;--delay:${-(index % 9) * 0.3}s`}></i>
		{/each}
	</div>
	<div class="win-content">
		<small>Lucky Flight</small>
		<strong>{t('payout')}</strong>
		<div
			class="win-amount"
			dir="ltr"
			style={`--amount-characters:${Math.max(6, targetWin.length)}`}
		>
			<b class="amount-reserve" aria-hidden="true">{targetWin}</b>
			<b class="amount-value">{win}</b>
		</div>
		<span dir="ltr">{multiplier}</span>
	</div>
</div>

<style>
	.win-celebration {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #091822ef;
		backdrop-filter: blur(8px);
		animation: reveal 350ms ease-out both;
	}
	.win-content {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		box-sizing: border-box;
		padding: 24px;
		text-align: center;
		font-family: var(--font-ui);
	}
	.win-celebration strong {
		color: #e2e9df;
		margin-block: 18px 22px;
		font-size: clamp(1.3rem, 4vw, 3rem);
		font-family: var(--font-display);
		letter-spacing: 0.16em;
	}
	.win-celebration span {
		min-width: 8ch;
		text-align: right;
		margin-top: 28px;
		padding: 9px 24px;
		border-radius: 999px;
		background: #213541;
		color: #ead6ab;
		font: 700 clamp(1rem, 3vw, 1.8rem) / 1 var(--font-ui);
		font-variant-numeric: tabular-nums;
	}
	.win-amount {
		display: grid;
		margin-top: 5px;
		max-width: 100%;
		color: #ffe3a0;
		font-size: min(
			clamp(2.8rem, 14vw, 12rem),
			calc((100vw - 48px) / (var(--amount-characters) * 0.7))
		);
		font-weight: 900;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.win-amount b {
		grid-area: 1 / 1;
		text-align: right;
	}
	.amount-reserve {
		visibility: hidden;
	}
	.win-celebration small {
		margin-top: 5px;
		color: #bfced5;
		font: 600 clamp(0.75rem, 2vw, 1rem) / 1 var(--font-display);
		letter-spacing: 0.1em;
	}
	.win-celebration i {
		position: absolute;
		left: var(--x);
		top: -20px;
		width: 7px;
		height: 12px;
		border-radius: 2px;
		background: #e8c671;
		animation: celebration-particle calc(2.5s + var(--i) * 0.04s) linear var(--delay) infinite;
	}
	.win-celebration i:nth-child(3n) {
		background: #d7e4de;
		width: 5px;
		height: 5px;
	}
	.sparkles {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	@keyframes reveal {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes celebration-particle {
		to {
			transform: translate3d(40px, 110vh, 0) rotate(400deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.win-celebration,
		.win-celebration i {
			animation: none;
		}
		.sparkles {
			display: none;
		}
	}
</style>
