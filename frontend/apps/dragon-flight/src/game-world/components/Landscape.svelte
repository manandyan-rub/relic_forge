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
		ending?: SuccessfulEnding;
		playbackSpeed?: number;
		huntScene?: boolean;
	};
	let { stage, weather, timeOfDay, ending, playbackSpeed = 1, huntScene = false }: Props = $props();
	const requestedSrc = $derived(
		ending && !huntScene
			? getFinishBackground(ending, weather, timeOfDay)
			: getLandscapeBackground(weather, timeOfDay),
	);
	let displayedSrc = $state(getLandscapeBackground('clear', 'day'));
	let reducedMotion = $state(false);

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

<div class="landscape" data-stage={stage} aria-hidden="true">
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
			style={`--landing-x:${LANDING_ANCHOR.x * 100}%;--landing-y:${LANDING_ANCHOR.y * 100}%;`}
			transition:fade={{ duration: reducedMotion ? 0 : 220 / playbackSpeed }}
		/>
	{/key}
</div>

<style>
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
		user-select: none;
	}
	.finish-scene {
		/* Keep the landing anchor visible with any cover crop. */
		object-position: var(--landing-x) var(--landing-y);
	}
	/* Background artwork is fixed. Only birds, hazards and weather effects move. */
</style>
