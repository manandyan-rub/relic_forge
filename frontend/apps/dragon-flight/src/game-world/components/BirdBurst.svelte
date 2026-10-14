<script lang="ts">
	import type { CreatureId } from '../types';

	let {
		bird,
		x,
		y,
		progress,
		compact = false,
	}: {
		bird: CreatureId;
		x: number;
		y: number;
		progress: number;
		compact?: boolean;
	} = $props();

	// The world's shared presentation clock owns this effect. Fixed geometry
	// makes every replay identical and requires no media, timers or extra rAF.
	const feathers = Array.from({ length: 12 }, (_, index) => {
		const angle = (index * 137.5 * Math.PI) / 180;
		const distance = 31 + (index % 4) * 12;
		return {
			x: Math.cos(angle) * distance,
			y: Math.sin(angle) * distance,
			rotation: index * 37,
			spin: index % 2 ? 110 : -100,
			scale: 0.45 + (index % 3) * 0.16,
		};
	});
	const palette: Record<CreatureId, readonly [string, string]> = {
		woodpecker: ['#d95135', '#eee5c8'],
		'azure-swift': ['#369dcc', '#b9e2f3'],
		eagle: ['#8e6745', '#f4eedb'],
		archaeopteryx: ['#bb7445', '#efc394'],
	};
	const p = $derived(Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 1);
	const spread = $derived(1 - (1 - p) ** 2);
	const opacity = $derived(Math.min(1, p * 18) * (1 - p));
</script>

<svg
	class="bird-burst"
	class:compact
	viewBox="-100 -100 200 200"
	style={`transform:translate3d(${x}px,${y}px,0) translate(-50%,-50%);opacity:${opacity};`}
	aria-hidden="true"
>
	<g class="impact" opacity={Math.max(0, 1 - p * 4)}>
		<circle r={7 + spread * 30} fill="none" stroke="#f9e4ad" stroke-width={2 - p} />
		<circle r={3 + spread * 12} fill="#fff5d7" />
	</g>
	{#each feathers as feather, index (index)}
		<g
			class="feather"
			transform={`translate(${feather.x * spread},${feather.y * spread + p * p * 22}) rotate(${feather.rotation + p * feather.spin}) scale(${feather.scale * (1 - p * 0.3)})`}
		>
			<path d="M0-10C6-4 8 7 0 11C-6 5-6-5 0-10Z" fill={palette[bird][index % 2]} />
			<path d="M0-7 0 14M0 1 4-2M0 5-3 2" stroke="#17232e" stroke-width=".8" fill="none" />
		</g>
	{/each}
</svg>

<style>
	.bird-burst {
		position: absolute;
		top: 0;
		left: 0;
		width: clamp(150px, 30vw, 270px);
		height: auto;
		overflow: visible;
		z-index: 30;
		pointer-events: none;
	}
	.bird-burst.compact {
		width: clamp(105px, 20vw, 180px);
	}
	@media (prefers-reduced-motion: reduce) {
		.feather {
			display: none;
		}
	}
</style>
