<script lang="ts">
	import type { PurchaseReceiptData } from './types';

	let { receipt }: { receipt: PurchaseReceiptData | null } = $props();
	const description = $derived(
		receipt
			? `${receipt.world} ${receipt.bonus} · Base bet ${receipt.baseBet} · Purchase ${receipt.multiplier}× = ${receipt.paid} · Feature win ${receipt.win ?? 'Pending'} · ${receipt.currency}`
			: undefined,
	);
</script>

<div
	class="purchase-receipt"
	class:empty={!receipt}
	role="group"
	aria-hidden={!receipt}
	aria-label="Bonus purchase receipt"
	title={description}
>
	{#if receipt}
		<div class="receipt-heading">
			<strong>{receipt.world} <span>{receipt.bonus}</span></strong>
			<span
				class="receipt-multiplier"
				aria-label={`Purchase multiplier ${receipt.multiplier} times`}>{receipt.multiplier}×</span
			>
		</div>
		<dl class="receipt-metrics">
			<div>
				<dt>Base bet</dt>
				<dd title={receipt.baseBet}>{receipt.baseBet}</dd>
			</div>
			<div>
				<dt>Paid</dt>
				<dd title={receipt.paid}>{receipt.paid}</dd>
			</div>
			<div>
				<dt>Feature win</dt>
				<dd title={receipt.win ?? 'Pending'}>{receipt.win ?? '—'}</dd>
			</div>
		</dl>
	{/if}
</div>
