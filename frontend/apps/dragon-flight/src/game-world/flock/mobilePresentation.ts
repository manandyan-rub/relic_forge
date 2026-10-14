import { base } from '$app/paths';
import type { CreatureId, FlightRisk, FlightRound } from '../types';
import type { ActiveBird } from './types';

export type HunterAppearance = 'forest' | 'ranger';
// Presentation values carried over from lucky-flight-mobile. These are not
// probability, hitbox, survival or payout inputs.
export const BIRD_HEALTH: Record<CreatureId, number> = {
	woodpecker: 50,
	'azure-swift': 60,
	eagle: 85,
	archaeopteryx: 100,
};
export const HUNTERS = [
	{ id: 'forest', name: 'Forest Hunter' },
	{ id: 'ranger', name: 'Mountain Ranger' },
] as const;
export const RISK_WEAPONS = {
	safe: {
		id: 'glock',
		name: 'Glock 17',
		file: 'glock-17.png',
		damage: 28,
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
		damage: 50,
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
		damage: 45,
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
	health: number;
	damage: number;
	shots: number;
	duration: number;
	shotInterval: number;
	bulletFlight: number;
};
// A short volley illustrates ONE authored elimination. There is no collision
// simulation: only the timeline's commit is allowed to remove its outcome slot.
export function planHunterAttack(species: CreatureId, risk: FlightRisk): HunterAttack {
	const health = BIRD_HEALTH[species];
	const damage = RISK_WEAPONS[risk].damage;
	const shots = Math.ceil(health / damage);
	// Presentation milliseconds. A projectile must finish before the next shot
	// replaces it; neither health nor screen width should change its travel time.
	const bulletFlight = 160;
	const shotInterval = risk === 'balanced' ? 220 : 160;
	const duration = Math.max(600, (100 + (shots - 1) * shotInterval + bulletFlight) / HUNTER_IMPACT);
	return { health, damage, shots, duration, shotInterval, bulletFlight };
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
		health: Math.max(0, attack.health - completed * attack.damage),
		flash: completed > 0 && sinceImpact >= -1e-8 && sinceImpact < 90,
	};
}
export function applyHunterHealth(
	birds: ActiveBird[],
	id: CreatureId,
	health: number,
	flash: boolean,
) {
	return birds.map((bird) =>
		bird.id === id && bird.alive
			? {
					...bird,
					health: Math.max(1, Math.min(bird.maxHealth, health)),
					hitFlash: flash ? 0.12 : bird.hitFlash,
					body:
						health < bird.health
							? {
									...bird.body,
									velocity: { x: bird.body.velocity.x - 18, y: bird.body.velocity.y - 45 },
								}
							: bird.body,
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
