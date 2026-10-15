<script lang="ts">
	import type { EncounterType } from '../types';
	import { ENCOUNTER_ARTWORK } from '../encounterArtwork';
	import { ENCOUNTER_LABELS } from '../presentation';

	type Props = {
		encounterType: EncounterType;
		result: 'pass' | 'crash';
		phase: 'enter' | 'engage' | 'resolve';
		target?: { x: number; y: number; progress: number; worldWidth: number };
	};

	let { encounterType, result, phase, target }: Props = $props();
</script>

<div class={`encounter-event ${encounterType} ${phase} ${result}`}>
	<img
		class="encounter-artwork"
		class:targeted={Boolean(target)}
		style={target
			? `animation:none;right:auto;top:0;left:0;width:120px;height:100px;transform:translate3d(calc(${target.x}px + (${target.worldWidth}px - ${target.x}px) * ${1 - target.progress}),${target.y}px,0) translate(-50%,-50%);`
			: undefined}
		src={ENCOUNTER_ARTWORK[encounterType]}
		alt=""
		draggable="false"
	/>
	<div class="encounter-label">
		<strong>{ENCOUNTER_LABELS[encounterType]}</strong><span
			>{phase === 'resolve' ? result.toUpperCase() : 'ENCOUNTER'}</span
		>
	</div>
</div>

<style>
	.encounter-event {
		position: absolute;
		z-index: 10;
		inset: 0;
		overflow: hidden;
		color: #aaae9a;
		pointer-events: none;
	}
	.encounter-artwork {
		position: absolute;
		right: -2%;
		top: 18%;
		width: clamp(190px, 38%, 410px);
		height: 55%;
		object-fit: contain;
		opacity: 0.96;
		filter: none;
		transform: translateX(115%);
		animation: encounter-enter calc(0.38s / var(--playback-speed, 1)) ease-out forwards;
	}
	.encounter-label {
		position: absolute;
		top: 38%;
		left: 49%;
		display: grid;
		gap: 5px;
		padding: 9px 13px;
		border-left: 2px solid #d6b37b;
		border-radius: 4px;
		background: #1a2a30e8;
	}
	.encounter-label strong {
		color: #f1e4c8;
		font: 800 0.72rem/1 var(--font-ui);
		letter-spacing: 0.08em;
	}
	.encounter-label span {
		font: 700 0.56rem/1 var(--font-ui);
		letter-spacing: 0.12em;
	}
	.engage .encounter-artwork {
		transform: translateX(0);
		animation: encounter-swoop calc(0.32s / var(--playback-speed, 1)) ease-in-out infinite alternate;
	}
	.resolve.pass .encounter-artwork {
		animation: encounter-pass calc(0.48s / var(--playback-speed, 1)) ease-in forwards;
	}
	.resolve.crash .encounter-artwork {
		animation: encounter-crash calc(0.42s / var(--playback-speed, 1)) ease-in forwards;
	}
	.resolve.pass .encounter-label {
		color: #b3d7b5;
	}
	@keyframes encounter-enter {
		to {
			transform: translateX(0);
		}
	}
	@keyframes encounter-swoop {
		to {
			transform: translate(-2.5%, 1%) rotate(-6deg);
		}
	}
	@keyframes encounter-pass {
		to {
			opacity: 0;
			transform: translate(28%, -20%) scale(0.8);
		}
	}
	@keyframes encounter-crash {
		to {
			transform: translateX(-8%) scale(1.12);
		}
	}
	@media (max-width: 620px) {
		.encounter-label {
			top: 42%;
			left: 32%;
		}
		.encounter-artwork {
			width: 58%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.encounter-artwork,
		.engage .encounter-artwork,
		.resolve.pass .encounter-artwork,
		.resolve.crash .encounter-artwork {
			animation: none;
			transform: none;
		}
	}
</style>
