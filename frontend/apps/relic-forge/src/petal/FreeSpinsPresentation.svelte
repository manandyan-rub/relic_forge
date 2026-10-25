<script lang="ts">
 import { tr } from './i18n';
	let {
		active,
		current,
		remaining,
		total,
	}: { active: boolean; current: number; remaining: number; total: string } = $props();
	const progress = $derived(
		remaining === 0
			? tr('Feature complete')
			: current > 0
				? tr(`Free spin ${current} of 10`)
				: tr(`${remaining} free spins`),
	);
	const compactProgress = $derived(
		remaining === 0 ? tr('Complete') : current > 0 ? tr(`Spin ${current} / 10`) : tr(`${remaining} free spins`),
	);
</script>

{#if active}
	<div class="free-spins-banner" role="status" aria-atomic="true">
		<span class="free-spins-kicker">{tr("THE PETALS AWAKEN")}</span>
		<strong class="free-spins-count" aria-label={progress}>
			<span class="free-spins-progress-full" aria-hidden="true">{progress}</span>
			<span class="free-spins-progress-compact" aria-hidden="true">{compactProgress}</span>
		</strong>
		<span class="free-spins-win"
			><span>{tr("Feature win")}</span><strong title={total}>{total}</strong></span
		>
	</div>
{/if}
