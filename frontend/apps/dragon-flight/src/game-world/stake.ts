import type {
	FlightRound,
	FlightRisk,
	BonusFlightId,
	CreatureId,
	LaunchStyle,
	FlightEvent,
	FlightStageId,
} from './types';
import { readStakeFlock } from './flock/stakeOutcome';
import { validateFlock } from './flock/outcome';

export const STAKE_MODES = {
	safe: 1,
	balanced: 1,
	danger: 1,
	'storm-run': 20,
	'summit-expedition': 50,
} as const;
export type StakeMode = keyof typeof STAKE_MODES;

export async function loadStakeReplay(search: string, fetcher: typeof fetch = fetch) {
	const params = new URLSearchParams(search);
	const host = params.get('rgs_url') ?? '';
	const url = new URL(host.includes('://') ? host : `https://${host}`);
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	)
		throw new Error('Invalid replay address');
	const parts = ['game', 'version', 'mode', 'event'].map((key) => {
		const value = params.get(key);
		if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Missing replay parameters');
		return value;
	});
	const mode = choice(parts[2], Object.keys(STAKE_MODES) as StakeMode[]);
	if (params.get('social') === 'true')
		throw new Error('Social replay is not supported by this review build');
	// Optional display parameters must not prevent an otherwise valid public replay.
	const requestedCurrency = params.get('currency')?.trim().toUpperCase() ?? '';
	const currency = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : 'USD';
	const requestedAmount = params.get('amount') ?? '';
	const replayAmount = /^\d+$/.test(requestedAmount) ? Number(requestedAmount) : NaN;
	const amount = Number.isSafeInteger(replayAmount) && replayAmount > 0 ? replayAmount : 1000000;
	const response = await fetcher(`${url.origin}/bet/replay/${parts.join('/')}`, {
		signal: AbortSignal.timeout(15000),
	});
	if (!response.ok) throw new Error('Could not load replay');
	const data = object(await response.json());
	if (
		data.costMultiplier !== STAKE_MODES[mode] ||
		typeof data.payoutMultiplier !== 'number' ||
		!Number.isFinite(data.payoutMultiplier) ||
		data.payoutMultiplier < 0
	)
		throw new Error('Invalid replay payout');
	const round = decodeStakeRound(
		{
			mode,
			amount,
			payout: Math.round(amount * data.payoutMultiplier),
			roundID: integer(Number(parts[3])),
			state: data.state,
			active: false,
		},
		{ creature: 'archaeopteryx', launchStyle: 'glide' },
	);
	return { round, currency };
}
type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid server response');
	return value as Json;
};
const integer = (value: unknown): number => {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		throw new Error('Invalid server amount');
	return value as number;
};
const choice = <T extends string>(value: unknown, values: readonly T[]): T => {
	if (!values.includes(value as T)) throw new Error('Unsupported flight event');
	return value as T;
};
const stages: FlightStageId[] = [
	'MOUNTAIN_VALLEY',
	'FOREST_GORGE',
	'VOLCANIC_CANYON',
	'STORM_HIGHLANDS',
	'SKY_PEAKS',
];
const endings = [
	'safeLanding',
	'meadowLanding',
	'ridgeLanding',
	'hiddenValley',
	'summitLanding',
] as const;

// RGS money uses millionths; book multipliers use hundredths. Neither is cents.
export function decodeStakeRound(
	value: unknown,
	options: { creature: CreatureId; launchStyle: LaunchStyle },
): FlightRound {
	const round = object(value);
	const mode = choice(round.mode, Object.keys(STAKE_MODES) as StakeMode[]);
	const amount = integer(round.amount);
	const payout = integer(round.payout);
	const flockBook = Array.isArray(round.state) ? undefined : readStakeFlock(round.state);
	const rawEvents = flockBook?.events ?? round.state;
	if (!amount || !Array.isArray(rawEvents) || rawEvents.length < 2 || rawEvents.length > 100)
		throw new Error('Invalid flight book');
	if (flockBook && STAKE_MODES[mode] !== 1) throw new Error('Flock book is not a feature buy');
	const source = rawEvents.map(object);
	const risk = mode === 'storm-run' || mode === 'summit-expedition' ? 'danger' : mode;
	const stagePlan: FlightRound['stagePlan'] = [{ stage: 'MOUNTAIN_VALLEY', eventIndex: 0 }];
	let crashed = false;
	let landed = false;
	let finalUnits = 0;
	const events: FlightEvent[] = source.map((event, index) => {
		if (
			event.index !== index ||
			(index === 0 && event.type !== 'launch') ||
			(index === source.length - 1 && event.type !== 'finalWin')
		)
			throw new Error('Invalid event order');
		if (!flockBook && (crashed || landed) && event.type !== 'finalWin')
			throw new Error('Events after flight ended');
		if (event.stage !== undefined) {
			const stage = choice(event.stage, stages);
			if (stage !== stagePlan.at(-1)?.stage) stagePlan.push({ stage, eventIndex: index });
		}
		const multiplier = () => integer(event.multiplierUnits) / 100;
		switch (event.type) {
			case 'elimination':
				if (!flockBook) throw new Error('Flock event in legacy book');
				return {
					type: 'elimination',
					bird: choice(event.bird, ['woodpecker', 'azure-swift', 'eagle', 'archaeopteryx']),
					reason: choice(event.reason, ['terrain', 'wind', 'predator', 'hunter']),
				};
			case 'championFlight':
				if (!flockBook) throw new Error('Champion event in legacy book');
				return { type: 'championFlight', multiplier: multiplier() };
			case 'launch':
				if (index !== 0 || event.path !== risk) throw new Error('Invalid launch mode');
				return { type: 'launch', path: risk as FlightRisk };
			case 'gate': {
				const result = choice(event.result, ['pass', 'crash']);
				const gapRatio = Number(event.gapRatio);
				if (!Number.isFinite(gapRatio) || gapRatio < 0.1 || gapRatio > 0.9 || !integer(event.gate))
					throw new Error('Invalid gate');
				const gate = {
					type: 'gate' as const,
					gate: event.gate as number,
					gapRatio,
					hazard: choice(event.hazard, [
						'cliffGap',
						'rockfall',
						'forestPass',
						'lavaColumn',
						'rockSpires',
						'windPass',
					]),
				};
				crashed = result === 'crash';
				return crashed
					? { ...gate, result: 'crash', crashSide: choice(event.crashSide, ['upper', 'lower']) }
					: { ...gate, result: 'pass' };
			}
			case 'pickup':
				return {
					type: 'pickup',
					pickupType: choice(event.pickupType, [
						'feather',
						'amberCrystal',
						'greenCrystal',
						'goldenFeather',
						'skyCrystal',
					]),
					multiplier: multiplier(),
				};
			case 'current':
				return {
					type: 'current',
					currentType: choice(event.currentType, [
						'risingCurrent',
						'ridgeCurrent',
						'valleyCurrent',
						'crosswind',
					]),
					multiplier: multiplier(),
				};
			case 'encounter': {
				// Older published books also use mountainRaptor; present both as the dragon.
				choice(event.encounterType, ['ridgeDragon', 'mountainRaptor']);
				const result = choice(event.result, ['pass', 'crash']);
				crashed = result === 'crash';
				return {
					type: 'encounter',
					encounterType: 'ridgeDragon',
					result,
					multiplier: multiplier(),
				};
			}
			case 'ending':
				landed = true;
				return { type: 'ending', ending: choice(event.ending, endings), multiplier: multiplier() };
			case 'finalWin':
				if (
					index !== source.length - 1 ||
					(!crashed && !landed && flockBook?.flock.survivors !== 0)
				)
					throw new Error('Missing terminal outcome');
				finalUnits = integer(event.payoutMultiplier);
				if (
					integer(event.multiplierUnits) !== finalUnits ||
					(!flockBook && crashed && finalUnits !== 0)
				)
					throw new Error('Inconsistent payout');
				// Allow only the sub-millionth truncation/rounding required by the wallet.
				if (Math.abs(payout - (amount * finalUnits) / 100) > 1)
					throw new Error('Wallet payout does not match book');
				return { type: 'finalWin', multiplier: finalUnits / 100, win: payout / 1e6 };
			default:
				throw new Error('Unknown flight event');
		}
	});
	const endingEvent = events.findLast((event) => event.type === 'ending');
	if (endingEvent && endingEvent.multiplier !== finalUnits / 100 && !flockBook)
		throw new Error('Landing payout mismatch');
	const decoded: FlightRound = {
		id: integer(round.betID ?? round.roundID),
		seed: 0,
		bet: amount / 1e6,
		risk,
		...options,
		...(STAKE_MODES[mode] > 1
			? {
					bonusFlight: mode as BonusFlightId,
					weather: mode === 'storm-run' ? ('storm' as const) : ('snow' as const),
					timeOfDay: mode === 'storm-run' ? ('day' as const) : ('dawn' as const),
				}
			: {}),
		entryCost: (amount * STAKE_MODES[mode]) / 1e6,
		events,
		stagePlan,
		ending: crashed || flockBook?.flock.survivors === 0 ? 'crash' : endingEvent!.ending,
		finalMultiplier: finalUnits / 100,
		finalWin: payout / 1e6,
		...(flockBook ? { flock: flockBook.flock, creature: 'archaeopteryx' as const } : {}),
	};
	if (flockBook) validateFlock(decoded);
	return decoded;
}

export function isValidStakeBet(
	amount: number,
	limits: Pick<WalletState, 'minBet' | 'maxBet' | 'stepBet' | 'levels'>,
): boolean {
	return (
		Number.isSafeInteger(amount) &&
		amount > 0 &&
		amount >= limits.minBet &&
		amount <= limits.maxBet &&
		amount % limits.stepBet === 0 &&
		(!limits.levels.length || limits.levels.includes(amount))
	);
}

// Parse decimal currency without rounding fractional millionths into a valid bet.
export function stakeBetUnits(value: string): number {
	if (!/^\d+(?:\.\d{0,6})?$/.test(value)) return NaN;
	const [whole, fraction = ''] = value.split('.');
	const units = Number(whole) * 1e6 + Number(fraction.padEnd(6, '0'));
	return Number.isSafeInteger(units) ? units : NaN;
}

export type WalletState = {
	live: boolean;
	ready: boolean;
	busy: boolean;
	active: boolean;
	amount: number;
	currency: string;
	levels: number[];
	minBet: number;
	maxBet: number;
	stepBet: number;
	defaultBet: number;
	spacebarDisabled: boolean;
	fullscreenDisabled: boolean;
	turboDisabled: boolean;
	buyDisabled: boolean;
	error: string;
};
export const initialWallet = (): WalletState => ({
	live: true,
	ready: false,
	busy: true,
	active: false,
	amount: 0,
	currency: 'USD',
	levels: [],
	minBet: 0,
	maxBet: 0,
	stepBet: 1,
	defaultBet: 0,
	spacebarDisabled: false,
	fullscreenDisabled: false,
	turboDisabled: false,
	buyDisabled: false,
	error: '',
});

export class StakeSession {
	state = initialWallet();
	private origin = '';
	private sessionID = '';
	private minimumDuration = 0;
	private started = 0;
	constructor(
		private changed: (state: WalletState) => void,
		private fetcher: typeof fetch = fetch,
	) {}
	private update(patch: Partial<WalletState>) {
		this.state = { ...this.state, ...patch };
		this.changed(this.state);
	}
	private async request(path: string, body: Json = {}) {
		const response = await this.fetcher(`${this.origin}/wallet/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...body, sessionID: this.sessionID }),
			signal: AbortSignal.timeout(15000),
		});
		const data = object(await response.json());
		if (!response.ok || data.error) throw new Error('Wallet request failed');
		const balance = object(data.balance);
		const amount = integer(balance.amount);
		if (typeof balance.currency !== 'string' || !/^[A-Z]{3}$/.test(balance.currency))
			throw new Error('Invalid currency');
		this.update({ amount, currency: balance.currency });
		return data;
	}
	async connect(search: string, allowDemo: boolean): Promise<unknown | undefined> {
		if (this.origin && this.state.busy) return;
		this.update({ busy: true, ready: false, error: '' });
		try {
			const params = new URLSearchParams(search);
			const session = params.get('sessionID');
			const host = params.get('rgs_url');
			if (!session && !host && allowDemo) {
				this.update({ live: false, ready: true, active: false });
				return;
			}
			if (!session || !host) throw new Error('Open this game from the Stake Engine launch link.');
			const url = new URL(host.includes('://') ? host : `https://${host}`);
			if (
				url.protocol !== 'https:' ||
				url.username ||
				url.password ||
				url.search ||
				url.hash ||
				url.pathname !== '/'
			)
				throw new Error('Invalid RGS address');
			this.origin = url.origin;
			this.sessionID = session;
			const data = await this.request('authenticate');
			const config = object(data.config);
			const minBet = integer(config.minBet);
			const maxBet = integer(config.maxBet);
			const stepBet = integer(config.stepBet);
			const limits = { minBet, maxBet, stepBet, levels: [] };
			const firstBet = Math.ceil(minBet / stepBet) * stepBet;
			if (!minBet || !stepBet || !isValidStakeBet(firstBet, limits))
				throw new Error('Invalid bet limits');
			if (config.betLevels !== undefined && !Array.isArray(config.betLevels))
				throw new Error('Invalid bet levels');
			const levels = ((config.betLevels as unknown[] | undefined) ?? []).map(integer);
			if (levels.some((amount) => !isValidStakeBet(amount, limits)))
				throw new Error('Invalid bet levels');
			const defaultBet =
				config.defaultBetLevel === undefined
					? levels.includes(1000000)
						? 1000000
						: (levels[0] ?? firstBet)
					: integer(config.defaultBetLevel);
			if (!isValidStakeBet(defaultBet, { ...limits, levels }))
				throw new Error('Invalid default bet');
			const jurisdiction = object(config.jurisdiction ?? {});
			this.minimumDuration = integer(jurisdiction.minimumRoundDuration ?? 0);
			if (this.minimumDuration > 60000) throw new Error('Unsupported minimum round duration');
			// This review build has English real-money terminology. Block unsupported social mode.
			if (jurisdiction.socialCasino === true)
				throw new Error('Social casino mode is not supported by this review build.');
			const round = data.round ? object(data.round) : undefined;
			if (round && typeof round.active !== 'boolean') throw new Error('Invalid round status');
			const active = round?.active === true;
			this.started = Date.now();
			this.update({
				ready: true,
				live: true,
				active,
				minBet,
				maxBet,
				stepBet,
				defaultBet,
				spacebarDisabled: jurisdiction.disabledSpacebar === true,
				fullscreenDisabled: jurisdiction.disabledFullscreen === true,
				levels: [...new Set(levels)].sort((a, b) => a - b),
				turboDisabled: jurisdiction.disabledTurbo === true,
				buyDisabled: jurisdiction.disabledBuyFeature === true,
			});
			return active ? round : undefined;
		} catch (error) {
			this.update({
				error: error instanceof Error ? error.message : 'Connection failed',
				ready: false,
			});
		} finally {
			this.update({ busy: false });
		}
	}
	async play(mode: StakeMode, amount: number): Promise<unknown> {
		if (!this.state.ready || this.state.busy || this.state.active)
			throw new Error('Wallet is not ready');
		integer(amount);
		if (
			!Object.hasOwn(STAKE_MODES, mode) ||
			(this.state.buyDisabled && STAKE_MODES[mode] > 1) ||
			!isValidStakeBet(amount, this.state) ||
			!Number.isSafeInteger(amount * STAKE_MODES[mode]) ||
			amount * STAKE_MODES[mode] > this.state.amount
		)
			throw new Error('Invalid bet or insufficient balance');
		this.update({ busy: true, error: '' });
		this.started = Date.now();
		try {
			const data = await this.request('play', { mode, amount, currency: this.state.currency });
			const round = object(data.round);
			if (typeof round.active !== 'boolean') throw new Error('Invalid round status');
			this.update({ active: round.active === true });
			if (round.amount !== amount || round.mode !== mode) throw new Error('Unexpected round');
			return round;
		} catch {
			this.update({
				ready: false,
				error: 'Could not confirm the bet. Reconnect to recover it before playing again.',
			});
			throw new Error(this.state.error);
		} finally {
			this.update({ busy: false });
		}
	}
	async settle() {
		if (!this.state.active) return;
		if (this.state.busy || !this.state.ready) throw new Error('Reconnect to finish this round');
		this.update({ busy: true });
		try {
			const wait = this.minimumDuration - (Date.now() - this.started);
			if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
			await this.request('end-round');
			this.update({ active: false });
		} catch {
			this.update({
				ready: false,
				error: 'Settlement could not be confirmed. Reconnect to recover your round.',
			});
			throw new Error(this.state.error);
		} finally {
			this.update({ busy: false });
		}
	}
	block(error?: unknown) {
		this.update({
			ready: false,
			error: `This flight could not be read${error instanceof Error ? ` (${error.message})` : ''}. Reconnect to recover the server round.`,
		});
	}
}
