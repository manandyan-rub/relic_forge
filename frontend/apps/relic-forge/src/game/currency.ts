export const formatCurrency = (amount: number, currency = 'USD') => {
	const code = currency.toUpperCase();
	const value = Number.isFinite(amount) ? amount : 0;
	if (['XSC', 'XGC', 'SC', 'GC'].includes(code)) {
		return `${code.replace(/^X/, '')} ${value.toFixed(2)}`;
	}
	try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value); }
	catch { return `${code} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value)}`; }
};
