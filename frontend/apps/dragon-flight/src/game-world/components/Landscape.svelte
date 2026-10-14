<script lang="ts">
	import { fade } from 'svelte/transition';
	import { decodeScene } from '../sceneCache';
	import {
		getLandscapeBackground,
		getFinishBackground,
		LANDING_ANCHOR,
		type SuccessfulEnding,
	} from '../backgrounds';
	import type { FlightStageId, TimeOfDay, WeatherCondition } from '../types';

	type Props = {
		stage: FlightStageId;
		weather: WeatherCondition;
		timeOfDay: TimeOfDay;
		parallaxOffset: number;
		ending?: SuccessfulEnding;
		playbackSpeed?: number;
		huntScene?: boolean;
	};
	let {
		stage,
		weather,
		timeOfDay,
		parallaxOffset,
		ending,
		playbackSpeed = 1,
		huntScene = false,
	}: Props = $props();
	const requestedSrc = $derived(
		ending && !huntScene
			? getFinishBackground(ending, weather, timeOfDay)
			: getLandscapeBackground(weather, timeOfDay),
	);
	let displayedSrc = $state(getLandscapeBackground('clear', 'day'));
	let reducedMotion = $state(false);
	const drift = $derived(Math.sin((parallaxOffset / 1800) * Math.PI * 2) * 1.4);

	$effect(() => {
		const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => (reducedMotion = preference.matches);
		update();
		preference.addEventListener('change', update);
		return () => preference.removeEventListener('change', update);
	});

	$effect(() => {
		const nextSrc = requestedSrc;
		if (nextSrc === displayedSrc) return;
		let cancelled = false;
		void decodeScene(nextSrc)
			.then(() => {
				if (!cancelled) displayedSrc = nextSrc;
			})
			.catch(() => {
				// Keep the last valid scene if a background cannot be downloaded.
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class="landscape"
	class:hunt-scene={huntScene}
	style={`--foreground-drift:${Math.sin((parallaxOffset / 1800) * Math.PI * 2) * 3.5}%;--camera-y:${Math.sin(parallaxOffset / 450) * 1.5}px;`}
	data-stage={stage}
	aria-hidden="true"
>
	{#key displayedSrc}
		<img
			class="landscape-image"
			class:finish-scene={displayedSrc.includes('/finishes/')}
			src={displayedSrc}
			alt=""
			width="1672"
			height="941"
			decoding="async"
			fetchpriority="high"
			draggable="false"
			style={`--landscape-drift:${drift}%;--landing-x:${LANDING_ANCHOR.x * 100}%;--landing-y:${LANDING_ANCHOR.y * 100}%;`}
			transition:fade={{ duration: reducedMotion ? 0 : 220 / playbackSpeed }}
		/>
	{/key}
	{#if !ending && !huntScene}<div
			class="foreground-parallax"
			style={`background-image:url("${displayedSrc}");`}
		></div>{/if}
</div>

<style>
	.foreground-parallax {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		mask-image: linear-gradient(transparent 65%, #000 95%);
		transform: translate(var(--foreground-drift), var(--camera-y)) scale(1.08);
		pointer-events: none;
	}
	.landscape {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #477a94;
		pointer-events: none;
	}
	.landscape-image {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		transform: translate(var(--landscape-drift), var(--camera-y)) scale(1.04);
		user-select: none;
	}
	.finish-scene {
		/* Keep the landing anchor visible with any cover crop. */
		object-position: var(--landing-x) var(--landing-y);
		transform: none;
	}
	/* Mobile hunt uses one cover image, with a gentle camera pan rather than
	   duplicating the bottom of the landscape or drawing a road over it. */
	.hunt-scene .landscape-image {
		transform: translate(var(--landscape-drift), var(--camera-y)) scale(1.045);
	}

	@media (prefers-reduced-motion: reduce) {
		.landscape-image,
		.foreground-parallax {
			transform: none;
		}
	}
</style>
