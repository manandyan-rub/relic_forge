<script lang="ts">
	import type { ActiveBird } from '../flock/types';
	import type { CreatureProfile } from '../types';
	let {
		bird,
		profile,
		frames,
	}: { bird: ActiveBird; profile: CreatureProfile; frames?: readonly ImageBitmap[] } = $props();
	let canvas = $state<HTMLCanvasElement>();
	let lastDrawn: ImageBitmap | undefined;
	$effect(() => {
		const frame = frames?.[bird.frame - 1];
		if (!canvas || !frame || frame === lastDrawn) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(
			frame,
			(canvas.width - frame.width * scale) / 2,
			(canvas.height - frame.height * scale) / 2,
			frame.width * scale,
			frame.height * scale,
		);
		lastDrawn = frame;
	});
</script>

<div
	class="flying-bird"
	class:eliminated={!bird.alive}
	class:hit={bird.hitFlash > 0}
	style={`transform:translate3d(${bird.body.position.x}px,${bird.body.position.y}px,0) translate(-50%,-50%) rotate(${bird.rotation}deg) scale(${profile.sizeScale});opacity:${bird.elimination ? Math.max(0, 1 - bird.elimination.age / 0.9) : 1};`}
	aria-hidden="true"
>
	{#if frames?.length}<canvas bind:this={canvas} width="450" height="300"></canvas>
	{:else}<img src={profile.assets?.flight} alt="" draggable="false" />{/if}
</div>

<style>
	.flying-bird {
		position: absolute;
		top: 0;
		left: 0;
		width: clamp(105px, 12vw, 190px);
		aspect-ratio: 1.5;
		z-index: 20;
		pointer-events: none;
		will-change: transform;
	}
	canvas,
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.eliminated {
		filter: brightness(1.3) saturate(0.7);
	}
	.hit {
		filter: brightness(1.8) drop-shadow(0 0 5px #fff0b8);
	}
	@media (max-width: 700px) {
		.flying-bird {
			width: clamp(72px, 23vw, 115px);
		}
	}
</style>
