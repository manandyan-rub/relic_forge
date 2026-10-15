<script lang="ts">
	import { CREATURES, getCreature } from '../creatures';
	import { FLOCK_ORDER, type FlockLineup } from '../flock/types';
	import type { CreatureId } from '../types';
	let {
		lineup,
		disabled = false,
		onSelect,
	}: {
		lineup: FlockLineup;
		disabled?: boolean;
		onSelect: (slot: number, species: CreatureId) => void;
	} = $props();
	const counts = $derived(
		CREATURES.map((bird) => ({
			name: bird.name,
			count: lineup.filter((id) => id === bird.id).length,
		})).filter((bird) => bird.count),
	);
	const colors: Record<CreatureId, string> = {
		eagle: '#f4cd78',
		woodpecker: '#b9c3ca',
		'azure-swift': '#65c9ff',
		archaeopteryx: '#ff6754',
	};
</script>

<fieldset {disabled} class="lineup-picker">
	<legend>FOUR-BIRD LINEUP</legend>
	<p>Choose a bird for each slot. You can use the same bird more than once.</p>
	<div class="slots">
		{#each lineup as species, slot (slot)}
			{@const bird = getCreature(species)}
			<label class="slot" style={`--bird-color:${colors[species]};`}>
				<span>Bird {slot + 1}</span>
				<div class="portrait"><img src={bird.assets?.portrait} alt="" draggable="false" /></div>
				<select
					aria-label={`Bird ${slot + 1} species`}
					value={species}
					onchange={(event) => onSelect(slot, event.currentTarget.value as CreatureId)}
				>
					{#each CREATURES as option (option.id)}<option value={option.id}>{option.name}</option
						>{/each}
				</select>
			</label>
		{/each}
	</div>
	<p class="counts" aria-live="polite">
		{counts.map((bird) => `${bird.count} × ${bird.name}`).join(' · ')}
	</p>
	<div class="bottom">
		<small>Same odds for every lineup. Champion Flight uses Archaeopteryx.</small><button
			type="button"
			onclick={() => FLOCK_ORDER.forEach((id, slot) => onSelect(slot, id))}>One of each</button
		>
	</div>
</fieldset>

<style>
	.lineup-picker {
		margin: 0 0 22px;
		padding: 0;
		border: 0;
		min-width: 0;
		color: #edf3ef;
		font-family: var(--font-ui);
	}
	legend {
		font-size: 0.86rem;
		font-weight: 700;
		color: #f4cd78;
		letter-spacing: 0.06em;
	}
	p {
		font-size: 0.82rem;
		color: #b9c6cc;
		line-height: 1.4;
		margin: 8px 0 12px;
	}
	.slots {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.slot {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 5px 8px;
		align-items: center;
		padding: 8px;
		border: 1px solid var(--bird-color);
		border-radius: 12px;
		background: #09151e;
		min-width: 0;
	}
	.slot span {
		grid-column: 1/-1;
		font-size: 0.8rem;
		color: var(--bird-color);
		font-weight: 700;
	}
	.portrait {
		width: 80px;
		height: 56px;
		overflow: hidden;
		justify-self: center;
		display: grid;
		place-items: center;
	}
	img {
		width: 56px;
		height: 52px;
		object-fit: contain;
		transform: scale(2.8);
	}
	select {
		width: 100%;
		min-width: 0;
		background: #16242d;
		border: 1px solid #61717b;
		border-radius: 6px;
		color: #edf3ef;
		min-height: 44px;
		font: inherit;
		font-family: var(--font-ui);
		font-size: 0.8rem;
		padding: 7px;
	}
	.counts {
		color: #f4cd78;
		font-weight: 700;
	}
	.bottom {
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: space-between;
	}
	small {
		color: #b9c6cc;
		font-size: 0.76rem;
		line-height: 1.4;
	}
	button {
		flex-shrink: 0;
		min-height: 44px;
		background: #15242c;
		color: #f4cd78;
		border: 1px solid #a58347;
		border-radius: 8px;
		padding: 8px;
		font-size: 0.8rem;
		cursor: pointer;
	}
	select:focus-visible,
	button:focus-visible {
		outline: 2px solid #f0d58c;
		outline-offset: 3px;
	}
	@media (max-width: 360px) {
		.slot {
			grid-template-columns: 1fr;
		}
		.portrait {
			width: 80px;
			height: 56px;
			overflow: hidden;
			justify-self: center;
			display: grid;
			place-items: center;
		}
		img {
			justify-self: center;
		}
		.bottom {
			align-items: flex-start;
		}
	}
</style>
