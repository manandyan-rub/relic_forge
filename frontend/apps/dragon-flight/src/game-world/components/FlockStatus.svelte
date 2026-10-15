<script lang="ts">
	import type { ActiveBird } from '../flock/types';
	import { getCreature } from '../creatures';
	let { birds, champion }: { birds: ActiveBird[]; champion: boolean } = $props();
</script>

<span
	class="flock-status"
	aria-label={champion
		? 'Champion Flight'
		: `${birds.filter((b) => b.alive).length} of four birds remain`}
>
	{#if champion}CHAMPION FLIGHT{:else}
		{#each birds as bird (bird.id)}<i
				class:alive={bird.alive}
				title={`${getCreature(bird.species ?? bird.id).name}: ${bird.alive ? 'flying' : 'eliminated'}`}
			></i>{/each}
		<b>{birds.filter((b) => b.alive).length}/4</b>
	{/if}
</span>

<style>
	.flock-status {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 7px 10px;
		border: 1px solid var(--glass-border);
		border-radius: 10px;
		background: var(--glass-background);
		color: #dfbd7c;
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		min-width: 76px;
	}
	i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #73838c;
		opacity: 0.4;
		transition:
			opacity calc(0.2s / var(--playback-speed, 1)),
			background-color calc(0.2s / var(--playback-speed, 1));
	}
	i.alive {
		background: #f4cd78;
		opacity: 1;
	}
	b {
		margin-left: 3px;
	}
	@media (max-width: 360px) {
		.flock-status {
			min-width: 0;
			padding: 7px 8px;
		}
		i {
			display: none;
		}
		b {
			margin: 0;
		}
	}
</style>
