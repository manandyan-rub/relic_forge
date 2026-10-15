import type { FlightEvent, FlightRound } from '../types';
import { HUNTER_IMPACT, planHunterAttack } from './mobilePresentation';
export type PresentationKind =
	| 'launch'
	| 'terrain'
	| 'wind'
	| 'predator'
	| 'hunter'
	| 'pickup'
	| 'landing'
	| 'champion'
	| 'result';
export function presentationKind(event: FlightEvent): PresentationKind {
	switch (event.type) {
		case 'gate':
			return event.hazard === 'windPass' ? 'wind' : 'terrain';
		case 'elimination':
			return event.reason;
		case 'current':
			return 'wind';
		case 'encounter':
			return 'predator';
		case 'ending':
			return 'landing';
		case 'championFlight':
			return 'champion';
		case 'finalWin':
			return 'result';
		default:
			return event.type;
	}
}
export function buildFlockTimeline(round: FlightRound) {
	const eliminationDuration = (event: FlightEvent) =>
		event.type === 'elimination' && event.reason === 'hunter'
			? planHunterAttack(round.risk).duration
			: 720;
	const championIndex = round.events.findIndex((e) => e.type === 'championFlight');
	const baseEvents = round.events.filter(
		(e, i) =>
			i < (championIndex < 0 ? round.events.length : championIndex) && e.type !== 'finalWin',
	);
	const minorCount = baseEvents.filter(
		(e) => !['launch', 'elimination', 'ending'].includes(e.type),
	).length;
	const reserved = baseEvents.reduce(
		(n, e) =>
			n +
			(e.type === 'launch'
				? 800
				: e.type === 'elimination'
					? eliminationDuration(e)
					: e.type === 'ending'
						? 850
						: 0),
		0,
	);
	const minorDuration = Math.max(400, Math.min(800, (9500 - reserved) / Math.max(1, minorCount)));
	const durations = round.events.map((e, i) => {
		if (e.type === 'finalWin') return 0;
		if (e.type === 'championFlight') return 850;
		if (championIndex >= 0 && i > championIndex)
			return e.type === 'encounter' ? 1800 : e.type === 'ending' ? 1100 : 1200;
		return e.type === 'launch'
			? 800
			: e.type === 'elimination'
				? eliminationDuration(e)
				: e.type === 'ending'
					? 850
					: minorDuration;
	});
	// Short books still need time to cross the landscape. These bridges keep
	// scenery and birds moving without stretching an impact or warning.
	const baseDuration = durations
		.slice(0, championIndex < 0 ? durations.length : championIndex)
		.reduce((n, d) => n + d, 0);
	const travelSlots = baseEvents.filter((e) => e.type !== 'launch').length;
	const targetBaseDuration = Math.max(
		baseDuration,
		Math.min(10500, Math.max(7000, 6000 + baseEvents.length * 300)),
	);
	const bridgeDuration = travelSlots ? (targetBaseDuration - baseDuration) / travelSlots : 0;
	const bridges = round.events.map((e, i) =>
		e.type !== 'launch' && e.type !== 'finalWin' && (championIndex < 0 || i < championIndex)
			? bridgeDuration
			: 0,
	);
	const total = durations.reduce((n, d, i) => n + d + bridges[i], 0);
	let elapsed = 0;
	return durations.map((duration, index) => {
		const start = elapsed;
		elapsed += duration + bridges[index];
		return {
			event: round.events[index],
			index,
			duration,
			travel: bridges[index],
			start,
			end: elapsed,
			total,
		};
	});
}
type Hooks = {
	valid: () => boolean;
	animate: (duration: number, update: (progress: number) => void) => Promise<boolean | void>;
	travel?: () => void;
	begin: (event: FlightEvent, index: number, kind: PresentationKind) => void;
	frame: (event: FlightEvent, progress: number) => void;
	commit: (event: FlightEvent) => void;
	progress: (value: number) => void;
	settle: () => Promise<void>;
};
// Outcomes stay serial. Cosmetic exits and particles continue on the shared tick.
export async function runFlockTimeline(round: FlightRound, hooks: Hooks) {
	for (const step of buildFlockTimeline(round)) {
		if (!hooks.valid()) return;
		if (step.event.type === 'finalWin') {
			await hooks.settle();
			return;
		}
		if (step.travel > 0) {
			hooks.travel?.();
			const continued = await hooks.animate(step.travel, (p) => {
				if (hooks.valid())
					hooks.progress(((step.start + step.travel * p) / Math.max(1, step.total)) * 100);
			});
			if (continued === false || !hooks.valid()) return;
		}
		hooks.begin(step.event, step.index, presentationKind(step.event));
		let committed = false;
		const continued = await hooks.animate(step.duration, (p) => {
			if (!hooks.valid()) return;
			hooks.progress(
				((step.start + step.travel + step.duration * p) / Math.max(1, step.total)) * 100,
			);
			hooks.frame(step.event, p);
			if (
				!committed &&
				p >=
					(step.event.type === 'elimination' ||
					(step.event.type === 'encounter' && step.event.result === 'crash')
						? step.event.type === 'elimination' && step.event.reason === 'hunter'
							? HUNTER_IMPACT
							: 0.52
						: step.event.type === 'championFlight'
							? 0.22
							: 1)
			) {
				committed = true;
				hooks.commit(step.event);
			}
		});
		if (continued === false || !hooks.valid()) return;
	}
}
