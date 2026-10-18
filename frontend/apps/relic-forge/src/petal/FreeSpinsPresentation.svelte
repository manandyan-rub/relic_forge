<script lang="ts">
	let {
		active,
		current,
		remaining,
		total,
	}: { active: boolean; current: number; remaining: number; total: string } = $props();
	const progress = $derived(
		remaining === 0
			? 'Feature complete'
			: current > 0
				? `Free spin ${current} of 10`
				: `${remaining} free spins`,
	);
	const compactProgress = $derived(
		remaining === 0 ? 'Complete' : current > 0 ? `Spin ${current} / 10` : `${remaining} free spins`,
	);
</script>

{#if active}
	<div class="free-spins-banner" role="status" aria-atomic="true">
		<span class="free-spins-kicker">THE PETALS AWAKEN</span>
		<strong class="free-spins-count" aria-label={progress}>
			<span class="free-spins-progress-full" aria-hidden="true">{progress}</span>
			<span class="free-spins-progress-compact" aria-hidden="true">{compactProgress}</span>
		</strong>
		<span class="free-spins-win"
			><span>Feature win</span><strong title={total}>{total}</strong></span
		>
	</div>
{/if}
