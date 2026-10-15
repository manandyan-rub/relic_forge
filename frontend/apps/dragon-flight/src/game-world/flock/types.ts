import type { CreatureId, FlightEnding, PlayerBody } from '../types';

export const FLOCK_ORDER = [
	'woodpecker',
	'azure-swift',
	'eagle',
	'archaeopteryx',
] as const satisfies readonly CreatureId[];
export type FlockLineup = [CreatureId, CreatureId, CreatureId, CreatureId];
export type EliminationReason = 'terrain' | 'wind' | 'predator' | 'hunter';
export type BirdRoundResult =
	| { bird: CreatureId; status: 'finish' }
	| {
			bird: CreatureId;
			status: 'eliminated';
			eliminatedAtEventIndex: number;
			eliminationReason: EliminationReason;
	  };
export type FlockOutcome = {
	version: 1;
	birds: BirdRoundResult[];
	survivors: number;
	baseMultiplier: number;
	bonusTriggered: boolean;
	bonus?: { bird: 'archaeopteryx'; multiplier: number; ending: FlightEnding };
};
export type ActiveBird = {
	// Stable outcome slot, independent of the selected species.
	id: CreatureId;
	species?: CreatureId;
	body: PlayerBody;
	alive: boolean;
	visible: boolean;
	launched: boolean;
	finished: boolean;
	launchDelay: number;
	age: number;
	frame: number;
	rotation: number;
	hitFlash: number;
	targetY: number;
	elimination?: { reason: EliminationReason; age: number };
	exiting: boolean;
};
