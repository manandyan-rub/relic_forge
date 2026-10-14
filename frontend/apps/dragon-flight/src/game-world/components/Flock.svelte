<script lang="ts">
	import type { CreatureId } from '../types';
	import type { ActiveBird } from '../flock/types';
	import { getCreature } from '../creatures';
	import FlyingBird from './FlyingBird.svelte';
	import BirdBurst from './BirdBurst.svelte';
	import BirdHealth from './BirdHealth.svelte';
	let {
		birds,
		frames,
		hidden = false,
		showHealth = false,
	}: {
		birds: ActiveBird[];
		frames: Partial<Record<CreatureId, readonly ImageBitmap[]>>;
		hidden?: boolean;
		showHealth?: boolean;
	} = $props();
</script>

{#if !hidden}
	{#each birds as bird (bird.id)}
		{#if bird.visible}
			{#if showHealth && bird.alive && !bird.exiting}<BirdHealth {bird} />{/if}
			{#if bird.elimination && bird.elimination.reason !== 'wind'}
				<BirdBurst
					compact
					progress={Math.min(1, bird.elimination.age / 0.75)}
					bird={bird.species ?? bird.id}
					x={bird.body.position.x}
					y={bird.body.position.y}
				/>
			{/if}
			<FlyingBird
				{bird}
				profile={getCreature(bird.species ?? bird.id)}
				frames={frames[bird.species ?? bird.id]}
			/>
		{/if}
	{/each}
{/if}
