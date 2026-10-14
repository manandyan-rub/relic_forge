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
	<div class="rays" aria-hidden="true"></div>
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
		background: radial-gradient(ellipse at center, #245e4bcc, #06191cec 65%, #02090bf5);
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
		font-family: 'Google Sans', sans-serif;
	}
	.win-celebration strong {
		color: #e2e9df;
		margin-block: 18px 22px;
		font-size: clamp(1.3rem, 4vw, 3rem);
		letter-spacing: 0.16em;
	}
	.win-celebration span {
		min-width: 8ch;
		text-align: right;
		margin-top: 28px;
		padding: 9px 24px;
		border-radius: 999px;
		background: #13352c99;
		color: #72efb2;
		font:
			800 clamp(1rem, 3vw, 1.8rem) / 1 system-ui,
			sans-serif;
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
		color: #a8d8c2;
		font:
			700 clamp(0.75rem, 2vw, 1rem) / 1 system-ui,
			sans-serif;
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
		background: #8ee8b9;
		width: 5px;
		height: 5px;
	}
	.rays {
		position: absolute;
		width: 150vmax;
		height: 150vmax;
		background: repeating-conic-gradient(from 0deg, #e7c66c0b 0deg 12deg, transparent 12deg 30deg);
		animation: rotate-rays 35s linear infinite;
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
	@keyframes rotate-rays {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes celebration-particle {
		to {
			transform: translate3d(40px, 110vh, 0) rotate(400deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.win-celebration,
		.rays,
		.win-celebration i {
			animation: none;
		}
		.sparkles {
			display: none;
		}
	}
</style>
