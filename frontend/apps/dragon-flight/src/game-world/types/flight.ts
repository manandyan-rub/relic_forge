import type { FlockLineup } from '../flock/types';
import type { HunterAppearance } from '../flock/mobilePresentation';
import type { CreatureId } from './creature';
import type { EliminationReason, FlockOutcome } from '../flock/types';

export type FlightRisk = 'safe' | 'balanced' | 'danger';
export type BonusFlightId = 'storm-run' | 'summit-expedition';

export type LaunchStyle = 'glide' | 'boost' | 'dive';

export type WeatherCondition = 'clear' | 'rain' | 'storm' | 'fog' | 'snow';

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night' | 'eclipse';

export type HazardType =
	| 'cliffGap'
	| 'rockfall'
	| 'forestPass'
	| 'lavaColumn'
	| 'rockSpires'
	| 'windPass';

export type PickupType =
	| 'feather'
	| 'amberCrystal'
	| 'greenCrystal'
	| 'goldenFeather'
	| 'skyCrystal';

export type CurrentType = 'risingCurrent' | 'ridgeCurrent' | 'valleyCurrent' | 'crosswind';

export type EncounterType = 'ridgeDragon';

export type FlightEnding =
	| 'crash'
	| 'safeLanding'
	| 'meadowLanding'
	| 'ridgeLanding'
	| 'hiddenValley'
	| 'summitLanding';

export type FlightStageId =
	| 'MOUNTAIN_VALLEY'
	| 'FOREST_GORGE'
	| 'VOLCANIC_CANYON'
	| 'STORM_HIGHLANDS'
	| 'SKY_PEAKS';

export type FlightStageMilestone = {
	stage: FlightStageId;
	eventIndex: number;
};

type GateEventBase = {
	type: 'gate';
	gate: number;
	hazard: HazardType;
	gapRatio: number;
};

export type FlightEvent =
	| { type: 'elimination'; bird: CreatureId; reason: EliminationReason }
	| { type: 'championFlight'; multiplier: number }
	| { type: 'launch'; path: FlightRisk }
	| (GateEventBase & { result: 'pass' })
	| (GateEventBase & { result: 'crash'; crashSide: 'upper' | 'lower' })
	| { type: 'pickup'; pickupType: PickupType; multiplier: number }
	| { type: 'current'; currentType: CurrentType; multiplier: number }
	| {
			type: 'encounter';
			encounterType: EncounterType;
			result: 'pass' | 'crash';
			multiplier: number;
	  }
	| { type: 'ending'; ending: Exclude<FlightEnding, 'crash'>; multiplier: number }
	| { type: 'finalWin'; multiplier: number; win: number };

export type FlightRound = {
	route?: 'tube-flight';
	// Absent only for legacy published books and existing feature-buy routes.
	flock?: FlockOutcome;
	// Cosmetic lineup snapshot for history and replay; never used to generate outcomes.
	lineup?: FlockLineup;
	// Cosmetic hunter snapshot, retained by local history/replay.
	hunter?: HunterAppearance;
	bonusFlight?: BonusFlightId;
	entryCost?: number;
	id: number;
	seed: number;
	bet: number;
	risk: FlightRisk;
	creature: CreatureId;
	launchStyle: LaunchStyle;
	weather?: WeatherCondition;
	timeOfDay?: TimeOfDay;
	events: FlightEvent[];
	stagePlan: FlightStageMilestone[];
	ending: FlightEnding;
	finalMultiplier: number;
	// Preserve up to four decimal places; two-decimal formatting is display-only.
	finalWin: number;
};

export type PrototypeStatus = 'ready' | 'flying' | 'collided' | 'ending' | 'complete';
