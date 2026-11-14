/**
 * Money display following Stake Engine's currency table (symbol, decimals, placement),
 * with crypto/unknown codes shown after the amount and sub-cent payouts kept exact
 * (RGS amounts have six decimal places).
 */
type Meta = { symbol: string; decimals: number; after?: boolean };
const META: Record<string, Meta> = {
	USD: { symbol: '$', decimals: 2 },
	CAD: { symbol: 'CA$', decimals: 2 },
	JPY: { symbol: '¥', decimals: 0 },
	EUR: { symbol: '€', decimals: 2 },
	RUB: { symbol: '₽', decimals: 2 },
	CNY: { symbol: 'CN¥', decimals: 2 },
	PHP: { symbol: '₱', decimals: 2 },
	INR: { symbol: '₹', decimals: 2 },
	IDR: { symbol: 'Rp', decimals: 0 },
	KRW: { symbol: '₩', decimals: 0 },
	BRL: { symbol: 'R$', decimals: 2 },
	MXN: { symbol: 'MX$', decimals: 2 },
	DKK: { symbol: 'KR', decimals: 2, after: true },
	PLN: { symbol: 'zł', decimals: 2, after: true },
	VND: { symbol: '₫', decimals: 0, after: true },
	TRY: { symbol: '₺', decimals: 2 },
	CLP: { symbol: 'CLP', decimals: 0, after: true },
	ARS: { symbol: 'ARS', decimals: 2, after: true },
	PEN: { symbol: 'S/', decimals: 2, after: true },
	XGC: { symbol: 'GC', decimals: 2, after: true },
	XSC: { symbol: 'SC', decimals: 2, after: true },
	XEC: { symbol: 'SC', decimals: 2, after: true },
	GC: { symbol: 'GC', decimals: 2, after: true },
	SC: { symbol: 'SC', decimals: 2, after: true },
	BTC: { symbol: 'BTC', decimals: 6, after: true },
	ETH: { symbol: 'ETH', decimals: 6, after: true },
	LTC: { symbol: 'LTC', decimals: 6, after: true },
	BCH: { symbol: 'BCH', decimals: 6, after: true },
};
const MAX_DECIMALS = 6;

export const formatCurrency = (amount: number, currency = 'USD') => {
	const code = (currency || 'USD').toUpperCase();
	const meta = META[code] ?? { symbol: code, decimals: 2, after: true };
	const value = Number.isFinite(amount) ? amount : 0;
	// Never round a real payout away: widen decimals until the RGS amount is shown exactly.
	let decimals = meta.decimals;
	// Floating-point steps (0.1 + 0.2) must not widen the display; only genuine sub-unit amounts do.
	const clean = Math.round(value * 10 ** MAX_DECIMALS) / 10 ** MAX_DECIMALS;
	while (decimals < MAX_DECIMALS && Math.abs(Number(clean.toFixed(decimals)) - clean) > 1e-9) decimals++;
	const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(clean));
	const sign = value < 0 ? '-' : '';
	return meta.after ? `${sign}${number} ${meta.symbol}` : `${sign}${meta.symbol}${number}`;
};

/** Smallest normal display step of a currency (used to quantize count-up frames). */
export const currencyStep = (currency = 'USD') => 10 ** -(META[(currency || 'USD').toUpperCase()]?.decimals ?? 2);
