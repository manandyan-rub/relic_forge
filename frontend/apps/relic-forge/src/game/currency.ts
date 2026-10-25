import { locale } from '../petal/i18n';
export const formatCurrency = (amount: number, currency = 'USD') => {
	const code = currency.toUpperCase();
	const value = Number.isFinite(amount) ? amount : 0;
	if (['XSC', 'XGC', 'SC', 'GC'].includes(code)) {
		return `${code.replace(/^X/, '')} ${new Intl.NumberFormat(locale(), {minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}`;
	}
	try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: code }).format(value); }
	catch { return `${code} ${new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value)}`; }
};
