import { base } from '$app/paths';
import type { CreatureId, CreatureProfile } from './types';

// Presentational creature profiles for the local prototype.

const decodedFlightFrameCache = new Map<string, Promise<readonly ImageBitmap[]>>();
const MAX_FRAME_WIDTH = 450;
const MAX_CONCURRENT_DECODES = 2;
let activeDecodes = 0;
const waitingDecodes: (() => void)[] = [];

async function decodeFlightFrame(source: string): Promise<ImageBitmap> {
	// All four species share this limit, including their initial preload. A small
	// WebP file can still expand into a large temporary bitmap while decoding.
	if (activeDecodes >= MAX_CONCURRENT_DECODES)
		await new Promise<void>((resolve) => waitingDecodes.push(resolve));
	else activeDecodes++;
	try {
		const response = await fetch(source, { cache: 'force-cache' });
		if (!response.ok) throw new Error(`Unable to load creature frame: ${source}`);
		const blob = await response.blob();
		let frame: ImageBitmap;
		try {
			// Leaving height unspecified preserves the artwork's natural aspect ratio.
			frame = await createImageBitmap(blob, {
				resizeWidth: MAX_FRAME_WIDTH,
				resizeQuality: 'high',
			});
		} catch {
			// Older bitmap implementations can reject resize options.
			frame = await createImageBitmap(blob);
		}
		if (frame.width <= MAX_FRAME_WIDTH) return frame;
		// Some browsers accept the options but ignore them. Bound the retained
		// bitmap in that case, and release the full-size temporary immediately.
		try {
			const canvas = document.createElement('canvas');
			canvas.width = MAX_FRAME_WIDTH;
			canvas.height = Math.max(1, Math.round((frame.height * MAX_FRAME_WIDTH) / frame.width));
			const context = canvas.getContext('2d');
			if (!context) throw new Error('Unable to resize creature frame');
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = 'high';
			context.drawImage(frame, 0, 0, canvas.width, canvas.height);
			return await createImageBitmap(canvas);
		} finally {
			frame.close();
		}
	} finally {
		const next = waitingDecodes.shift();
		if (next) next();
		else activeDecodes--;
	}
}

async function fetchAndDecodeFlightFrames(
	frames: readonly string[],
): Promise<readonly ImageBitmap[]> {
	const decoded: ImageBitmap[] = [];
	try {
		for (const source of frames) decoded.push(await decodeFlightFrame(source));
		return decoded;
	} catch (error) {
		for (const frame of decoded) frame.close();
		throw error;
	}
}

export function loadDecodedFlightFrames(
	frames: readonly string[],
): Promise<readonly ImageBitmap[]> {
	const cacheKey = frames.join('\n');
	const cachedFrames = decodedFlightFrameCache.get(cacheKey);
	if (cachedFrames) return cachedFrames;

	const loadedFrames = fetchAndDecodeFlightFrames(frames).catch((error) => {
		decodedFlightFrameCache.delete(cacheKey);
		throw error;
	});
	decodedFlightFrameCache.set(cacheKey, loadedFrames);
	return loadedFrames;
}

const AZURE_SWIFT_FRAMES = Array.from(
	{ length: 9 },
	(_, index) =>
		`${base || '.'}/creatures/azure-swift/fly-${String(index + 1).padStart(2, '0')}.webp`,
);

const AZURE_SWIFT_FRAME_ORDER = [1, 2, 3, 4, 5, 6, 7, 9, 2, 1] as const;

const ARCHAEOPTERYX_FRAMES = Array.from(
	{ length: 8 },
	(_, index) =>
		`${base || '.'}/creatures/archaeopteryx/fly-${String(index + 1).padStart(2, '0')}.webp`,
);

const ARCHAEOPTERYX_FRAME_ORDER = [8, 7, 6, 5, 4, 3, 2, 1, 7, 8] as const;

const EAGLE_FRAMES = Array.from(
	{ length: 8 },
	(_, index) => `${base || '.'}/creatures/eagle/fly-${String(index + 1).padStart(2, '0')}.webp`,
);
// Raised wings, downstroke, then the folded recovery pose before the next flap.
const EAGLE_FRAME_ORDER = [1, 2, 3, 4, 5, 8, 6, 7] as const;

const WOODPECKER_FRAMES = Array.from(
	{ length: 8 },
	(_, index) =>
		`${base || '.'}/creatures/woodpecker/fly-${String(index + 1).padStart(2, '0')}.webp`,
);
const WOODPECKER_FRAME_ORDER = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const CREATURES: CreatureProfile[] = [
	{
		id: 'woodpecker',
		name: 'Woodpecker',
		className: 'woodpecker',
		assets: {
			portrait: WOODPECKER_FRAMES[7],
			flight: WOODPECKER_FRAMES[0],
			result: WOODPECKER_FRAMES[7],
		},
		flightAnimation: {
			frames: WOODPECKER_FRAMES,
			frameOrder: WOODPECKER_FRAME_ORDER,
			fps: 10,
		},
		sizeScale: 0.82,
		agility: 1.2,
		damping: 0.92,
		maxVerticalSpeed: 340,
		rotationDivisor: 9.5,
		rotationLimit: 38,
		flapDuration: 145,
		hoverDuration: 1150,
		hoverLift: 6,
		description: 'Our smallest bird, with a red crest and spotted wings',
	},
	{
		id: 'eagle',
		name: 'Eagle',
		className: 'eagle',
		assets: {
			portrait: EAGLE_FRAMES[6],
			flight: EAGLE_FRAMES[0],
			result: EAGLE_FRAMES[6],
		},
		flightAnimation: {
			frames: EAGLE_FRAMES,
			frameOrder: EAGLE_FRAME_ORDER,
			fps: 10,
		},
		sizeScale: 1.1,
		agility: 1.08,
		damping: 0.935,
		maxVerticalSpeed: 320,
		rotationDivisor: 10.5,
		rotationLimit: 35,
		flapDuration: 165,
		hoverDuration: 1350,
		hoverLift: 5,
		description: 'A white-headed eagle with broad brown wings',
	},
	{
		id: 'azure-swift',
		name: 'Azure Swift',
		className: 'azure-swift',
		assets: {
			portrait: AZURE_SWIFT_FRAMES[2],
			flight: AZURE_SWIFT_FRAMES[0],
			result: AZURE_SWIFT_FRAMES[0],
		},
		flightAnimation: {
			frames: AZURE_SWIFT_FRAMES,
			frameOrder: AZURE_SWIFT_FRAME_ORDER,
			fps: 10,
		},
		sizeScale: 1.05,
		agility: 1.2,
		damping: 0.92,
		maxVerticalSpeed: 340,
		rotationDivisor: 9.5,
		rotationLimit: 38,
		flapDuration: 145,
		hoverDuration: 1150,
		hoverLift: 5,
		description: 'A swift blue flyer of high ridges',
	},
	{
		id: 'archaeopteryx',
		name: 'Archaeopteryx',
		className: 'archaeopteryx',
		assets: {
			portrait: ARCHAEOPTERYX_FRAMES[5],
			flight: ARCHAEOPTERYX_FRAMES[0],
			result: ARCHAEOPTERYX_FRAMES[0],
		},
		flightAnimation: {
			frames: ARCHAEOPTERYX_FRAMES,
			frameOrder: ARCHAEOPTERYX_FRAME_ORDER,
			fps: 10,
		},
		sizeScale: 1.3,
		agility: 1.08,
		damping: 0.935,
		maxVerticalSpeed: 320,
		rotationDivisor: 10.5,
		rotationLimit: 35,
		flapDuration: 165,
		hoverDuration: 1350,
		hoverLift: 5,
		description: 'Our largest bird, with broad prehistoric wings',
	},
];

export const getCreature = (id: CreatureId) =>
	CREATURES.find((creature) => creature.id === id) ??
	CREATURES.find((creature) => creature.id === 'archaeopteryx')!;
