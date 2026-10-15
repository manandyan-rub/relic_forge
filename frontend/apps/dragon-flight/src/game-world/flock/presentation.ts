import type { CreatureId, FlightRound, LaunchStyle, PlayerBody, WorldBounds } from '../types';
import { getCreature } from '../creatures';
import { clamp, createPlayer } from '../physics';
import { copyLineup } from './lineup';
import { speciesDrift } from './mobilePresentation';
import { FLOCK_ORDER, type FlockLineup, type ActiveBird, type EliminationReason } from './types';

function flockTop(bounds: WorldBounds) {
	return Math.min(
		bounds.floorY - 80,
		Math.max(bounds.width <= 700 ? 205 : 214, bounds.height * 0.38),
	);
}

export function createFlock(
	bounds: WorldBounds,
	round?: FlightRound,
	lineup?: FlockLineup,
): ActiveBird[] {
	const ids: readonly CreatureId[] = round && !round.flock ? [round.creature] : FLOCK_ORDER;
	const species = copyLineup(round?.flock ? round.lineup : lineup);
	const previewTop = flockTop(bounds);
	const previewBottom = Math.max(previewTop + 12, bounds.floorY - 28);
	const previewSpacing = Math.min(54, (previewBottom - previewTop) / Math.max(1, ids.length - 1));
	return ids.map((id, index) => ({
		id,
		species: round && !round.flock ? id : species[index],
		body: {
			...createPlayer(bounds),
			position: {
				x: round
					? -60 - index * 15
					: bounds.width * (0.17 + (index % 2) * 0.12 + Math.floor(index / 2) * 0.04),
				y: round ? bounds.floorY * (0.34 + index * 0.14) : previewTop + index * previewSpacing,
			},
		},
		alive: true,
		visible: true,
		launched: !round,
		finished: false,
		launchDelay: index * 0.1,
		age: round ? 0 : 1,
		frame: 1,
		rotation: 0,
		hitFlash: 0,
		targetY: bounds.floorY * 0.5,
		exiting: false,
	}));
}
export function updateBirdBody(
	birds: ActiveBird[],
	id: CreatureId,
	body: PlayerBody,
): ActiveBird[] {
	return birds.map((bird) => (bird.id === id ? { ...bird, body } : bird));
}
export function eliminateBird(
	birds: ActiveBird[],
	id: CreatureId,
	reason: EliminationReason,
): ActiveBird[] {
	return birds.map((bird) =>
		bird.id === id && bird.alive
			? {
					...bird,
					alive: false,
					hitFlash: 0,
					elimination: { reason, age: 0 },
					body: { ...bird.body, velocity: { x: -85, y: reason === 'wind' ? -160 : 120 } },
				}
			: bird,
	);
}
export function startChampion(birds: ActiveBird[]): ActiveBird[] {
	return birds.map((bird) =>
		bird.alive
			? {
					...bird,
					species: bird.id === 'archaeopteryx' ? 'archaeopteryx' : bird.species,
					frame: bird.id === 'archaeopteryx' ? 1 : bird.frame,
					exiting: bird.id !== 'archaeopteryx',
					finished: false,
				}
			: bird,
	);
}
export function resizeFlock(
	birds: ActiveBird[],
	before: WorldBounds,
	after: WorldBounds,
): ActiveBird[] {
	return birds.map((bird) => ({
		...bird,
		targetY: (bird.targetY * after.height) / before.height,
		body: {
			...bird.body,
			velocity: {
				x: (bird.body.velocity.x * after.width) / before.width,
				y: (bird.body.velocity.y * after.height) / before.height,
			},
			radius: clamp(after.width * 0.026, 17, 25),
			position: {
				x: (bird.body.position.x * after.width) / before.width,
				y: (bird.body.position.y * after.height) / before.height,
			},
		},
	}));
}

// Exact critically damped spring for a stationary target. No Euler overshoot.
function damp(position: number, velocity: number, target: number, omega: number, dt: number) {
	const offset = position - target;
	const c = velocity + omega * offset;
	const decay = Math.exp(-omega * dt);
	return {
		position: target + (offset + c * dt) * decay,
		velocity: (velocity - omega * c * dt) * decay,
	};
}
// Shared visual tick. Survival is changed only by authored events, never physics.
export function stepFlock(
	birds: ActiveBird[],
	delta: number,
	bounds: WorldBounds,
	targetY: number,
	moving: boolean,
	landing: number,
	launchStyle: LaunchStyle = 'glide',
	singleFlight = false,
): ActiveBird[] {
	const dt = Math.max(0, Math.min(delta, 0.1));
	let count = 0;
	let champion = false;
	for (const bird of birds) {
		if (bird.alive && !bird.exiting) count++;
		if (bird.exiting) champion = true;
	}
	const top = singleFlight ? 17 : flockTop(bounds);
	const bottom = singleFlight ? bounds.floorY - 17 : Math.max(top + 12, bounds.floorY - 28);
	const spacing = Math.min(54, (bottom - top) / Math.max(1, count - 1));
	const center = clamp(
		targetY,
		top + (spacing * (count - 1)) / 2,
		bottom - (spacing * (count - 1)) / 2,
	);
	let slot = 0;
	return birds.map((bird, index) => {
		if (bird.hitFlash > 0) bird = { ...bird, hitFlash: Math.max(0, bird.hitFlash - dt) };
		const age = bird.age + dt;
		const profile = getCreature(bird.species ?? bird.id);
		const animation = profile.flightAnimation;
		const frame = animation
			? animation.frameOrder[
					Math.floor((age + index * 0.071) * animation.fps) % animation.frameOrder.length
				]
			: 1;
		if (bird.elimination) {
			const elapsed = bird.elimination.age + dt;
			return {
				...bird,
				age,
				frame,
				visible: bird.visible && elapsed < 0.9,
				rotation: bird.rotation + dt * (bird.elimination.reason === 'wind' ? -100 : 70),
				elimination: { ...bird.elimination, age: elapsed },
				body: {
					...bird.body,
					position: {
						x: bird.body.position.x + bird.body.velocity.x * dt,
						y: bird.body.position.y + bird.body.velocity.y * dt,
					},
				},
			};
		}
		if (!bird.alive) return bird;
		if (bird.exiting)
			return {
				...bird,
				age,
				frame,
				visible: bird.visible && bird.body.position.x < bounds.width + 100,
				body: {
					...bird.body,
					position: {
						x: bird.body.position.x + dt * 470,
						y: bird.body.position.y - dt * (30 + index * 15),
					},
				},
			};
		const ownSlot = slot++;
		const goalY = clamp(
			center +
				(ownSlot - (count - 1) / 2) * spacing +
				(singleFlight ? 0 : speciesDrift(bird.species ?? bird.id, age, index * 1.7)),
			top,
			bottom,
		);
		const goalX =
			bounds.width * (champion ? 0.64 : 0.2 + (index % 2) * 0.24 + Math.floor(index / 2) * 0.035) +
			Math.sin(age * 0.8 + index) * 3;
		if (moving && age < bird.launchDelay) return { ...bird, age, frame, visible: false };
		if (moving && age < bird.launchDelay + 0.55) {
			const t = clamp((age - bird.launchDelay) / 0.55, 0, 1);
			const eased = 1 - (1 - t) ** 3;
			const arc =
				launchStyle === 'dive' ? -38 : launchStyle === 'boost' ? 42 : index % 2 ? -20 : 22;
			return {
				...bird,
				age,
				frame,
				visible: true,
				launched: true,
				targetY: goalY,
				rotation: arc * 0.2 * (1 - eased),
				body: {
					...bird.body,
					position: {
						x: -60 + (goalX + 60) * eased,
						y: goalY + Math.sin(((1 - t) * Math.PI) / 2) * arc,
					},
					velocity: {
						x: ((goalX + 60) * 3 * (1 - t) ** 2) / 0.55,
						y: (-arc * Math.cos(((1 - t) * Math.PI) / 2) * Math.PI) / (2 * 0.55),
					},
				},
			};
		}
		// Targets re-form over time; positions and velocities are preserved at handoff.
		const smoothed = bird.targetY + (goalY - bird.targetY) * (1 - Math.exp(-dt * (singleFlight ? 12 : 4)));
		const destinationX = landing ? bounds.width * 0.7 + ownSlot * 10 : goalX;
		const destinationY = landing ? bounds.floorY * 0.75 + ownSlot * 7 : smoothed;
		const x = damp(bird.body.position.x, bird.body.velocity.x, destinationX, 5, dt);
		const y = damp(bird.body.position.y, bird.body.velocity.y, destinationY, singleFlight ? 9 : 5 + index * 0.2, dt);
		const bank = clamp(y.velocity / profile.rotationDivisor + x.velocity * 0.025, -18, 18);
		return {
			...bird,
			age,
			frame,
			launched: true,
			visible: bird.visible || moving,
			finished: landing === 1,
			targetY: smoothed,
			rotation: bird.rotation + (bank - bird.rotation) * (1 - Math.exp(-dt * 8)),
			body: {
				...bird.body,
				position: { x: x.position, y: y.position },
				velocity: { x: x.velocity, y: y.velocity },
			},
		};
	});
}
