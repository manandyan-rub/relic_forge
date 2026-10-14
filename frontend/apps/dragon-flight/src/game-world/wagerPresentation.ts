import type { FlightRound, PrototypeStatus } from './types';

// The offer shown on the main button must describe the wager its action repeats.
export function menuFlightOffer(
	round: FlightRound | undefined,
	status: PrototypeStatus,
	baseBet: number,
) {
	const repeat = status === 'complete' && round?.bonusFlight ? round : undefined;
	const active = status !== 'ready' && status !== 'complete' ? round : undefined;
	return {
		bonusFlight: repeat?.bonusFlight,
		cost: active ? (active.entryCost ?? active.bet) : (repeat?.entryCost ?? baseBet),
		label: repeat ? ('buyAgain' as const) : ('fly' as const),
	};
}
