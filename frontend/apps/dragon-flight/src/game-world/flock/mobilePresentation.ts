import { base } from '$app/paths';
import type { CreatureId, FlightRisk, FlightRound } from '../types';
import type { ActiveBird } from './types';

export type HunterAppearance = 'forest' | 'ranger';
// Original placeholder artwork remains visible until the user's replacement
// art is ready. Appearance metadata also stays compatible with saved replays.
export const HUNTERS = [
	{ id: 'forest', name: 'Forest Hunter' },
	{ id: 'ranger', name: 'Mountain Ranger' },
] as const;
export const RISK_WEAPONS = {
	safe: {
		id: 'glock',
		name: 'Glock 17',
		file: 'glock-17.png',
		length: 28,
		grip: 0.47,
		muzzleX: 0.79,
		muzzleY: 0.26,
		recoil: 2,
	},
	balanced: {
		id: 'trail',
		name: 'Trail Rifle',
		file: 'trail-rifle.png',
		length: 57,
		grip: 0.36,
		muzzleX: 0.97,
		muzzleY: 0.4,
		recoil: 3,
	},
	danger: {
		id: 'ak47',
		name: 'AK-47',
		file: 'ak-47.png',
		length: 57,
		grip: 0.44,
		muzzleX: 0.99,
		muzzleY: 0.38,
		recoil: 5,
	},
} as const;
export const weaponImage = (risk: FlightRisk) =>
	`${base || '.'}/hunters/${RISK_WEAPONS[risk].file}`;
export const hunterImage = (appearance: HunterAppearance) =>
	`${base || '.'}/hunters/${appearance}-body.svg`;
export function attachHunter(
	round: FlightRound,
	hunter: HunterAppearance,
	replay: boolean,
): FlightRound {
	return replay || !round.flock ? round : { ...round, hunter: round.hunter ?? hunter };
}

export const HUNTER_IMPACT = 0.76;
export type HunterAttack = {
	shots: number;
	duration: number;
	shotInterval: number;
	bulletFlight: number;
};
// A short volley illustrates ONE authored elimination. There is no collision
// simulation: only the timeline's commit is allowed to remove its outcome slot.
export function planHunterAttack(risk: FlightRisk): HunterAttack {
	const shots = risk === 'safe' ? 1 : risk === 'balanced' ? 2 : 3;
	// Presentation milliseconds. A projectile must finish before the next shot
	// replaces it; cosmetic species never change its travel time or cadence.
	const bulletFlight = 160;
	const shotInterval = risk === 'balanced' ? 220 : 160;
	const duration = Math.max(600, (100 + (shots - 1) * shotInterval + bulletFlight) / HUNTER_IMPACT);
	return { shots, duration, shotInterval, bulletFlight };
}
export function hunterAttackFrame(attack: HunterAttack, progress: number) {
	const finalImpact = attack.duration * HUNTER_IMPACT;
	const start = finalImpact - (attack.shots - 1) * attack.shotInterval - attack.bulletFlight;
	const clock = Math.max(0, Math.min(1, progress)) * attack.duration - start;
	const index = Math.min(attack.shots - 1, Math.max(0, Math.floor(clock / attack.shotInterval)));
	const local = clock - index * attack.shotInterval;
	const completed = Math.min(
		attack.shots,
		Math.max(0, Math.floor((clock - attack.bulletFlight) / attack.shotInterval + 1 + 1e-8)),
	);
	const sinceImpact = clock - attack.bulletFlight - (completed - 1) * attack.shotInterval;
	return {
		index: clock < 0 ? -1 : index,
		bulletProgress: clock < 0 ? -1 : Math.min(1, local / attack.bulletFlight),
		impacts: completed,
		flash: completed > 0 && sinceImpact >= -1e-8 && sinceImpact < 90,
	};
}
export function applyHunterImpact(birds: ActiveBird[], id: CreatureId) {
	if (!birds.some((bird) => bird.id === id && bird.alive)) return birds;
	return birds.map((bird) =>
		bird.id === id && bird.alive
			? {
					...bird,
					hitFlash: 0.12,
					body: {
						...bird.body,
						velocity: { x: bird.body.velocity.x - 18, y: bird.body.velocity.y - 45 },
					},
				}
			: bird,
	);
}
// Distinct mobile flight patterns, scaled down to keep the casino formation readable.
export function speciesDrift(species: CreatureId, age: number, phase: number) {
	switch (species) {
		case 'woodpecker':
			return Math.sin(age * 1.3 + phase) * 3;
		case 'azure-swift':
			return Math.sin(age * 3 + phase) * 8;
		case 'eagle':
			return Math.max(0, Math.sin(age * 1.9 + phase)) * 7 - 3.5;
		case 'archaeopteryx':
			return Math.sin(age * 1.8 + phase) * 5 + Math.sin(age * 3.5 + phase) * 2;
	}
}
