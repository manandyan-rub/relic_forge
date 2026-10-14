// Preserve wallet millionths in labels, including fractional bets and payouts.
export function formatLocalAmount(value: number, currency = 'USD') {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		maximumFractionDigits: 6,
		useGrouping: false,
	}).format(value);
}

// Count-up labels keep the final amount's precision, including trailing zeros.
// Build this once per result so decimal columns cannot change on every frame.
export function createWinAmountFormatter(finalAmount: number, currency = 'USD') {
	const options = {
		style: 'currency' as const,
		currency,
		maximumFractionDigits: 6,
		useGrouping: false,
	};
	const minimum = new Intl.NumberFormat('en-US', options).resolvedOptions().minimumFractionDigits;
	const precision = (
		Math.abs(finalAmount)
			.toFixed(6)
			.match(/\.(\d*?[1-9])0*$/)?.[1] ?? ''
	).length;
	const fractionDigits = Math.max(minimum, precision);
	return new Intl.NumberFormat('en-US', {
		...options,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}
