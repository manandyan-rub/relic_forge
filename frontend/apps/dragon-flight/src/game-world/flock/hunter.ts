import type { FlightRisk, WorldBounds } from '../types';
import { RISK_WEAPONS } from './mobilePresentation';

export type HunterShot = { target: { x: number; y: number }; progress: number; hit: boolean };

// Visual trajectory only. A hit is authored by the round's elimination event.
export function hunterTrajectory(
	bounds: WorldBounds,
	shot: HunterShot,
	risk: FlightRisk = 'balanced',
) {
	const scale = bounds.width < 700 ? 0.58 : 0.9;
	const origin = { x: bounds.width * 0.88, y: bounds.floorY - 127 * scale };
	const angle = Math.atan2(shot.target.y - origin.y, shot.target.x - origin.x);
	const muzzle = {
		x: origin.x + Math.cos(angle) * RISK_WEAPONS[risk].length * scale,
		y: origin.y + Math.sin(angle) * RISK_WEAPONS[risk].length * scale,
	};
	const progress = Math.max(0, Math.min(1, shot.progress));
	return {
		scale,
		origin,
		muzzle,
		angle: (angle * 180) / Math.PI,
		bullet: {
			x: muzzle.x + (shot.target.x - muzzle.x) * progress,
			y: muzzle.y + (shot.target.y - muzzle.y) * progress,
		},
	};
}
