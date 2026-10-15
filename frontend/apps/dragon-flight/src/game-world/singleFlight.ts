import type { ActiveGate, CreatureId, FlightEvent, FlightRisk, WorldBounds } from './types';
import { getCreature } from './creatures';
import { clamp } from './physics';
import { getTerrainVisualWidth } from './terrainArtwork';

// Presentation geometry only. The authored pass/crash is never inferred from collision physics.
export const birdDisplayWidth = (bounds: WorldBounds) =>
	bounds.width <= 700 ? clamp(bounds.width * 0.23, 72, 115) : clamp(bounds.width * 0.12, 105, 190);

export function singleBirdExtent(bounds: WorldBounds, species: CreatureId) {
	const width = birdDisplayWidth(bounds) * getCreature(species).sizeScale;
	return { x: width / 2, y: width / 3 };
}

export function createSingleGate(
	event: Extract<FlightEvent, { type: 'gate' }>,
	risk: FlightRisk,
	bounds: WorldBounds,
	species: CreatureId,
): ActiveGate {
	const extent = singleBirdExtent(bounds, species);
	const top = bounds.width <= 700 ? 170 : 185;
	const available = bounds.floorY - top - 8;
	const fraction = risk === 'safe' ? 0.44 : risk === 'danger' ? 0.29 : 0.35;
	const gapHeight = Math.min(available, Math.max(extent.y * 2 + 18, bounds.height * fraction));
	const gapCenterY = clamp(event.gapRatio * bounds.floorY, top + gapHeight / 2, bounds.floorY - 8 - gapHeight / 2);
	const width = clamp(bounds.width * 0.19, 95, 210);
	const gate = { ...event, x: 0, width, gapCenterY, gapHeight };
	const visualWidth = gateVisualWidth(gate, bounds);
	gate.x = bounds.width + 45 + Math.max(0, visualWidth - width) / 2;
	return gate;
}

export function gateVisualWidth(gate: ActiveGate, bounds: WorldBounds) {
	return getTerrainVisualWidth(
		gate.hazard === 'forestPass' ? 'tree' : 'rock',
		gate.gapCenterY - gate.gapHeight / 2,
		bounds.height - gate.gapCenterY - gate.gapHeight / 2,
	);
}

export function singleGateTarget(gate: ActiveGate, bounds: WorldBounds, species: CreatureId) {
	if (gate.result === 'pass') return gate.gapCenterY;
	const extent = singleBirdExtent(bounds, species);
	const edge = gate.gapCenterY + (gate.crashSide === 'upper' ? -1 : 1) * gate.gapHeight / 2;
	return clamp(edge + (gate.crashSide === 'upper' ? -1 : 1) * extent.y * 0.45, extent.y, bounds.floorY - extent.y);
}

export function singleGateContact(
	gate: ActiveGate,
	bounds: WorldBounds,
	species: CreatureId,
	birdX: number,
) {
	const visualWidth = gate.result === 'crash'
		? getTerrainVisualWidth(
			gate.hazard === 'forestPass' ? 'tree' : 'rock',
			gate.crashSide === 'upper' ? gate.gapCenterY - gate.gapHeight / 2 : 0,
			gate.crashSide === 'lower' ? bounds.height - gate.gapCenterY - gate.gapHeight / 2 : 0,
		)
		: gateVisualWidth(gate, bounds);
	const center = gate.x + gate.width / 2;
	const extent = singleBirdExtent(bounds, species).x;
	return gate.result === 'crash'
		? center - visualWidth / 2 <= birdX + extent * 0.6
		: center + visualWidth / 2 < birdX - extent;
}
