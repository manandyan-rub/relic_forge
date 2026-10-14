import { MAX_PROTOTYPE_BET, MIN_PROTOTYPE_BET } from '../config';
import { roundToTwoDecimals } from './number';

export const roundBet = roundToTwoDecimals;

export function clampBet(value: number) {
	return roundBet(Math.min(MAX_PROTOTYPE_BET, Math.max(MIN_PROTOTYPE_BET, value)));
}

export function isBetInputValid(value: string) {
	if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return false;
	const numericValue = Number(value);
	return (
		Number.isFinite(numericValue) &&
		numericValue >= MIN_PROTOTYPE_BET &&
		numericValue <= MAX_PROTOTYPE_BET
	);
}

export function sanitizeBetInput(value: string, fallback: string) {
	const normalized = value.trim().replace(',', '.');
	return /^\d*(?:\.\d{0,2})?$/.test(normalized) ? normalized : fallback;
}

type BetPresetLimits = {
	minBet: number;
	maxBet: number;
	stepBet: number;
	levels: readonly number[];
};

// Wallet limits use integer millionths. Preset labels use currency amounts.
export function permittedBetPresets(limits: BetPresetLimits): number[] {
	const { minBet, maxBet, stepBet, levels } = limits;
	if (
		![minBet, maxBet, stepBet].every(Number.isSafeInteger) ||
		minBet <= 0 ||
		maxBet < minBet ||
		stepBet <= 0
	)
		return [];
	const valid = (units: number) =>
		Number.isSafeInteger(units) && units >= minBet && units <= maxBet && units % stepBet === 0;
	const allowed = levels.length
		? [...new Set(levels.filter(valid))].sort((a, b) => a - b)
		: undefined;
	const standard = [1, 5, 10, 50, 100];
	if (
		standard.every((amount) => valid(amount * 1e6) && (!allowed || allowed.includes(amount * 1e6)))
	) {
		return standard;
	}
	if (allowed) {
		const count = Math.min(5, allowed.length);
		return Array.from(
			{ length: count },
			(_, index) =>
				allowed[count === 1 ? 0 : Math.floor((index * (allowed.length - 1)) / (count - 1))] / 1e6,
		);
	}
	// Sample the range arithmetically instead of enumerating every permitted unit.
	const step = BigInt(stepBet);
	const first = ((BigInt(minBet) + step - 1n) / step) * step;
	const last = (BigInt(maxBet) / step) * step;
	if (first > last) return [];
	const slots = (last - first) / step + 1n;
	const count = Number(slots < 5n ? slots : 5n);
	return Array.from({ length: count }, (_, index) => {
		const slot = count === 1 ? 0n : (BigInt(index) * (slots - 1n)) / BigInt(count - 1);
		return Number(first + slot * step) / 1e6;
	});
}
