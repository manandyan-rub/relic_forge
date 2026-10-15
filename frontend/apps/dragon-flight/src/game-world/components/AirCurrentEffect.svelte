<script lang="ts">
	import type { CurrentType } from '../types';
	import { CURRENT_LABELS } from '../presentation';

	type Props = {
		currentType: CurrentType;
		phase: 'approach' | 'enter' | 'release';
		multiplier: number;
	};

	let { currentType, phase, multiplier }: Props = $props();
</script>

<div class={`current-event ${currentType} ${phase}`}>
	<div class="current-ring"><i></i><b></b><span>x{multiplier.toFixed(2)}</span></div>
	<strong>{CURRENT_LABELS[currentType]}</strong>
</div>

<style>
	.current-event {
		position: absolute;
		z-index: 10;
		top: 50%;
		left: 70%;
		display: grid;
		place-items: center;
		color: #d0e6eb;
		transform: translate(-50%, -50%);
		pointer-events: none;
		animation: current-approach calc(0.34s / var(--playback-speed, 1)) ease-out both;
	}
	.current-ring {
		position: relative;
		display: grid;
		width: clamp(100px, 18vw, 190px);
		aspect-ratio: 0.72;
		place-items: center;
		border: 3px solid currentColor;
		border-inline-color: transparent;
		border-radius: 50%;
		background: radial-gradient(ellipse, transparent 50%, #d5e9ee22 65%, transparent 72%);
	}
	.current-ring::before,
	.current-ring::after,
	.current-ring i,
	.current-ring b {
		content: '';
		position: absolute;
		border: 2px solid currentColor;
		border-inline-color: transparent;
		border-radius: 50%;
	}
	.current-ring::before {
		inset: -12%;
		opacity: 0.45;
		animation: current-spin calc(1.2s / var(--playback-speed, 1)) linear infinite;
	}
	.current-ring::after {
		inset: 13%;
		opacity: 0.65;
		animation: current-spin calc(0.8s / var(--playback-speed, 1)) linear infinite reverse;
	}
	.current-ring i {
		inset: 25%;
		opacity: 0.35;
	}
	.current-ring b {
		inset: -26%;
		opacity: 0.18;
	}
	.current-ring span {
		padding: 6px 9px;
		border-radius: 5px;
		background: #203640bb;
		color: #eff5f0;
		font: 800 clamp(0.72rem, 1.5vw, 1rem) / 1 var(--font-ui);
	}
	.current-event > strong {
		margin-top: 14px;
		padding: 7px 10px;
		border-radius: 5px;
		background: #142c32dd;
		color: #e2eeea;
		font: 700 0.61rem/1 var(--font-ui);
		letter-spacing: 0.1em;
	}
	.current-event.enter {
		animation: current-enter calc(0.38s / var(--playback-speed, 1)) ease-in both;
	}
	.current-event.release {
		animation: current-release calc(0.3s / var(--playback-speed, 1)) ease-out both;
	}
	.ridgeCurrent {
		color: #c5ddce;
	}
	.valleyCurrent {
		color: #d8ddbf;
	}
	.crosswind {
		color: #b9cad6;
	}
	.crosswind .current-ring {
		transform: rotate(-18deg);
	}
	@keyframes current-approach {
		from {
			opacity: 0;
			transform: translate(25%, -50%) scale(0.55);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@keyframes current-enter {
		to {
			opacity: 0.2;
			transform: translate(-155%, -50%) scale(1.8);
		}
	}
	@keyframes current-release {
		from {
			opacity: 0.2;
			transform: translate(-100%, -50%) scale(1.5);
		}
		to {
			opacity: 0;
			transform: translate(-130%, -50%) scale(2);
		}
	}
	@keyframes current-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.current-event,
		.current-ring::before,
		.current-ring::after {
			animation: none;
		}
	}
</style>
