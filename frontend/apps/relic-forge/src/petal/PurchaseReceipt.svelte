<script lang="ts">
 import { tr, t } from './i18n';
	import type { PurchaseReceiptData } from './types';

	let { receipt }: { receipt: PurchaseReceiptData | null } = $props();
	const description = $derived(receipt ? `${receipt.world} ${receipt.bonus} · ${t('baseBet')} ${receipt.baseBet} · ${t('fullCost')} ${receipt.paid} · ${t('featureWin')} ${receipt.win??t('pending')} · ${receipt.currency}` : undefined);
</script>

<div
	class="purchase-receipt"
	class:empty={!receipt}
	role="group"
	aria-hidden={!receipt}
	aria-label={t('fullCost')}
	title={description}
>
	{#if receipt}
		<div class="receipt-heading">
			<strong>{receipt.world} <span>{receipt.bonus}</span></strong>
			<span
				class="receipt-multiplier"
				aria-label={`${t('purchaseMultiplier')} ${receipt.multiplier}×`}>{receipt.multiplier}×</span
			>
		</div>
		<dl class="receipt-metrics">
			<div>
				<dt>{tr("Base bet")}</dt>
				<dd title={receipt.baseBet}>{receipt.baseBet}</dd>
			</div>
			<div>
				<dt>{tr("Paid")}</dt>
				<dd title={receipt.paid}>{receipt.paid}</dd>
			</div>
			<div>
				<dt>{tr("Feature win")}</dt>
				<dd title={receipt.win ?? tr('Pending')}>{receipt.win ?? '—'}</dd>
			</div>
		</dl>
	{/if}
</div>
