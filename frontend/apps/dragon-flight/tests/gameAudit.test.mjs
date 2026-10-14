import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadTypescript } from './typescript.mjs';
import { evaluateProfile, settledReturn } from './baseMath.mjs';

const load = (name, options) =>
	loadTypescript(new URL(`../src/game-world/${name}.ts`, import.meta.url), options);
const { generateMockRound, RISK_PROFILES } = await load('mockRound');
const { validateFlock } = await load('flock/outcome');
const { payoutForMultiplier } = await load('utils/number');
const { createWinAmountFormatter, formatLocalAmount } = await load('utils/format');
const { isBetInputValid, sanitizeBetInput, permittedBetPresets } = await load('utils/bet');
const { CREATURES, loadDecodedFlightFrames } = await load('creatures');
const { createPlayer, steerPlayer } = await load('physics');
const { DEV_SCENARIOS, createDevFlightRound } = await load('devScenarios');
const appearance = { creature: 'archaeopteryx', launchStyle: 'glide' };

function bitmapEnvironment({ rejectResize = false, ignoreResize = false, failedSource = '' } = {}) {
	const previous = {
		fetch: globalThis.fetch,
		bitmap: globalThis.createImageBitmap,
		document: globalThis.document,
	};
	const fetched = [],
		options = [],
		bitmaps = [],
		drawn = [];
	let active = 0,
		maximumActive = 0;
	globalThis.fetch = async (source, init) => {
		assert.equal(init.cache, 'force-cache');
		fetched.push(source);
		return { ok: source !== failedSource, blob: async () => ({ width: 4093, height: 2894 }) };
	};
	globalThis.createImageBitmap = async (source, resize) => {
		options.push(resize);
		active++;
		maximumActive = Math.max(maximumActive, active);
		try {
			await new Promise((resolve) => setImmediate(resolve));
			if (resize && rejectResize) throw new Error('Resize options unsupported');
			const width = resize && !ignoreResize ? resize.resizeWidth : source.width;
			const bitmap = {
				width,
				height: Math.round((source.height * width) / source.width),
				closed: false,
				close() {
					this.closed = true;
				},
			};
			bitmaps.push(bitmap);
			return bitmap;
		} finally {
			active--;
		}
	};
	globalThis.document = {
		createElement(tag) {
			assert.equal(tag, 'canvas');
			return {
				width: 0,
				height: 0,
				getContext: () => ({ drawImage: (...args) => drawn.push(args) }),
			};
		},
	};
	return {
		fetched,
		options,
		bitmaps,
		drawn,
		get maximumActive() {
			return maximumActive;
		},
		restore() {
			globalThis.fetch = previous.fetch;
			if (previous.bitmap) globalThis.createImageBitmap = previous.bitmap;
			else delete globalThis.createImageBitmap;
			if (previous.document) globalThis.document = previous.document;
			else delete globalThis.document;
		},
	};
}

test('flight bitmaps are shared, bounded and decoded at most two at a time across all four species', async () => {
	const env = bitmapEnvironment();
	try {
		const requests = CREATURES.map((creature) =>
			loadDecodedFlightFrames(creature.flightAnimation.frames),
		);
		assert.equal(loadDecodedFlightFrames(CREATURES[0].flightAnimation.frames), requests[0]);
		const frames = await Promise.all(requests);
		assert.equal(env.fetched.length, 33);
		assert(env.maximumActive <= 2);
		assert.equal(env.maximumActive, 2);
		for (const resized of frames.flat()) {
			assert.equal(resized.width, 450);
			assert.equal(resized.height, 318);
			assert.equal(resized.closed, false);
		}
		for (const resize of env.options)
			assert.deepEqual(resize, { resizeWidth: 450, resizeQuality: 'high' });
		assert.equal(await loadDecodedFlightFrames(CREATURES[0].flightAnimation.frames), frames[0]);
		assert.equal(env.fetched.length, 33, 'a new round must reuse loaded bitmaps');
	} finally {
		env.restore();
	}
});

test('browser resize fallbacks preserve aspect and release full-size temporary bitmaps', async () => {
	for (const mode of ['rejectResize', 'ignoreResize']) {
		const env = bitmapEnvironment({ [mode]: true });
		try {
			const [frame] = await loadDecodedFlightFrames([`./fallback-${mode}.webp`]);
			assert.equal(frame.width, 450);
			assert.equal(frame.height, 318);
			assert.equal(env.drawn.length, 1);
			assert.equal(env.bitmaps[0].closed, true);
			assert.equal(frame.closed, false);
		} finally {
			env.restore();
		}
	}
});

test('failed frame loads close partial results, release decoder slots and permit a fresh retry', async () => {
	const frames = ['./cleanup-first.webp', './cleanup-failed.webp'];
	let env = bitmapEnvironment({ failedSource: frames[1] });
	try {
		await assert.rejects(loadDecodedFlightFrames(frames), /Unable to load creature frame/);
		assert.equal(env.bitmaps.length, 1);
		assert.equal(env.bitmaps[0].closed, true);
	} finally {
		env.restore();
	}
	env = bitmapEnvironment();
	try {
		assert.equal((await loadDecodedFlightFrames(frames)).length, 2);
		assert.equal(env.fetched.length, 2);
	} finally {
		env.restore();
	}
});

test('authored WebP frames fit below a 20MiB retained RGBA budget at sprite resolution', () => {
	let originalBytes = 0,
		retainedBytes = 0;
	for (const creature of CREATURES)
		for (const source of creature.flightAnimation.frames) {
			const bytes = fs.readFileSync(new URL('../static' + source.slice(1), import.meta.url));
			assert.equal(bytes.toString('ascii', 12, 16), 'VP8L');
			const dimensions = bytes.readUInt32LE(21);
			const width = 1 + (dimensions & 0x3fff),
				height = 1 + ((dimensions >>> 14) & 0x3fff);
			originalBytes += width * height * 4;
			retainedBytes += 450 * Math.round((height * 450) / width) * 4;
		}
	assert(originalBytes > 800 * 1024 ** 2);
	assert(retainedBytes < 20 * 1024 ** 2);
});

test('normal profiles target 96% and retain increasing volatility across risks', () => {
	const profiles = ['safe', 'balanced', 'danger'].map((risk) =>
		evaluateProfile(RISK_PROFILES[risk]),
	);
	for (const profile of profiles) {
		assert(Math.abs(profile.rtp - 0.96) < 1e-10, `RTP drift: ${profile.rtp}`);
		assert(Math.abs([...profile.payouts.values()].reduce((a, b) => a + b, 0) - 1) < 1e-10);
		assert(Math.abs(settledReturn(profile.payouts, 100) - 0.96) < 1e-10);
	}
	for (let index = 1; index < profiles.length; index++) {
		assert(profiles[index].survival < profiles[index - 1].survival);
		assert(profiles[index].variance > profiles[index - 1].variance);
	}
});

test('every supported cent bet settles at 96% theoretical return', () => {
	for (const profile of Object.values(RISK_PROFILES)) {
		const { payouts } = evaluateProfile(profile);
		for (let cents = 10; cents <= 10000; cents++) {
			assert(Math.abs(settledReturn(payouts, cents) - 0.96) < 1e-10);
		}
	}
});

test('settlement and display preserve fractional wallet units', () => {
	assert.equal(payoutForMultiplier(0.1, 1.45), 0.145);
	assert.equal(formatLocalAmount(0.145), '$0.145');
	assert.equal(formatLocalAmount(0.125), '$0.125');
	assert.equal(formatLocalAmount(-0.145), '-$0.145');
	assert.equal(formatLocalAmount(12), '$12.00');
	for (let cents = 10; cents <= 10000; cents += 7)
		for (let hundredths = 100; hundredths <= 5000; hundredths += 5) {
			const integerProduct = BigInt(cents) * BigInt(hundredths);
			const expected = Number(integerProduct) / 10000;
			assert.equal(payoutForMultiplier(cents / 100, hundredths / 100), expected);
		}
});
test('win counters keep their final decimal precision without rounding away wallet units', () => {
	const fractional = createWinAmountFormatter(0.145);
	assert.equal(fractional.format(0), '$0.000');
	assert.equal(fractional.format(0.02), '$0.020');
	assert.equal(fractional.format(0.1), '$0.100');
	assert.equal(fractional.format(0.145), '$0.145');
	for (const [amount, currency, decimals] of [
		[12, 'USD', 2],
		[6.25, 'USD', 2],
		[0.145, 'USD', 3],
		[123.0125, 'EUR', 4],
		[0.000016, 'USD', 6],
		[123, 'JPY', 0],
		[1.125, 'JPY', 3],
	]) {
		const formatter = createWinAmountFormatter(amount, currency);
		for (let frame = 0; frame <= 120; frame++) {
			const parts = formatter.formatToParts((amount * frame) / 120);
			assert.equal(parts.find((part) => part.type === 'fraction')?.value.length ?? 0, decimals);
		}
		assert.equal(formatter.format(amount), formatLocalAmount(amount, currency));
	}
});

test('normal rounds reject invalid bets, risk and round IDs', () => {
	for (const bet of [NaN, Infinity, -1, 0, 0.09, 1.001, 100.01])
		assert.throws(() => generateMockRound(bet, 'safe', 1, appearance));
	for (const id of [NaN, 0, -1, 0.5, Infinity])
		assert.throws(() => generateMockRound(1, 'safe', id, appearance));
	for (const risk of ['unknown', 'constructor'])
		assert.throws(() => generateMockRound(1, risk, 1, appearance));
	for (const input of ['', '-1', '1e2', 'Infinity', '0.09', '1.001'])
		assert.equal(isBetInputValid(input), false);
	assert.equal(sanitizeBetInput('1,25', '1.00'), '1.25');
});

test('wallet presets use permitted levels and retain familiar amounts when valid', () => {
	const limits = { minBet: 100000, maxBet: 100000000, stepBet: 100000, levels: [] };
	assert.deepEqual(permittedBetPresets(limits), [1, 5, 10, 50, 100]);
	assert.deepEqual(
		permittedBetPresets({ ...limits, levels: [600000, 200000, 400000, 200000] }),
		[0.2, 0.4, 0.6],
	);
	assert.deepEqual(permittedBetPresets({ ...limits, levels: [NaN, 1, 123456, 200000] }), [0.2]);
	assert.deepEqual(permittedBetPresets({ ...limits, levels: [123456] }), []);
	assert.deepEqual(
		permittedBetPresets({ ...limits, levels: [1000000, 5000000, 10000000, 50000000, 100000000] }),
		[1, 5, 10, 50, 100],
	);
	const many = {
		...limits,
		levels: Array.from({ length: 11 }, (_, index) => (index + 1) * 200000),
	};
	const presets = permittedBetPresets(many);
	assert.equal(presets.length, 5);
	assert.deepEqual(presets, [0.2, 0.6, 1.2, 1.6, 2.2]);
	for (const amount of presets) assert(many.levels.includes(Math.round(amount * 1e6)));
});

test('wallet presets align wager steps and sample huge ranges without enumerating units', () => {
	assert.deepEqual(
		permittedBetPresets({ minBet: 110000, maxBet: 610000, stepBet: 200000, levels: [] }),
		[0.2, 0.4, 0.6],
	);
	assert.deepEqual(
		permittedBetPresets({ minBet: 210000, maxBet: 390000, stepBet: 200000, levels: [] }),
		[],
	);
	assert.deepEqual(
		permittedBetPresets({ minBet: 199999, maxBet: 200001, stepBet: 200000, levels: [] }),
		[0.2],
	);
	const huge = { minBet: 1, maxBet: 8000000000000000, stepBet: 3, levels: [] };
	const presets = permittedBetPresets(huge);
	assert.equal(presets.length, 5);
	assert.equal(presets[0], 0.000003);
	assert.equal(presets.at(-1), 7999999999.999998);
	assert.equal(new Set(presets).size, 5);
	assert(presets.every((amount, index) => !index || amount > presets[index - 1]));
	for (const bad of [
		{ ...huge, stepBet: 0 },
		{ ...huge, maxBet: Infinity },
		{ ...huge, minBet: -1 },
	])
		assert.deepEqual(permittedBetPresets(bad), []);
});
function auditRound(round) {
	assert(Number.isFinite(round.finalWin));
	assert.equal(round.finalWin, payoutForMultiplier(round.bet, round.finalMultiplier));
	assert.equal(round.events[0].type, 'launch');
	assert.deepEqual(round.events.at(-1), {
		type: 'finalWin',
		multiplier: round.finalMultiplier,
		win: round.finalWin,
	});
	assert.equal(round.events.filter((e) => e.type === 'finalWin').length, 1);
	if (round.flock) validateFlock(round);
	else assert.equal(round.finalWin === 0, round.ending === 'crash');
	const fatal = round.events.findIndex(
		(e) => (e.type === 'gate' || e.type === 'encounter') && e.result === 'crash',
	);
	if (fatal >= 0) assert.equal(fatal, round.events.length - 2);
	assert(
		round.stagePlan.every(
			(s, i) =>
				s.eventIndex < round.events.length &&
				(i === 0 || s.eventIndex > round.stagePlan[i - 1].eventIndex),
		),
	);
}
for (const [risk, profile] of Object.entries(RISK_PROFILES)) {
	test(`${risk}: 100,000 seeded rounds agree with profile expectation and event accounting`, () => {
		const theory = evaluateProfile(profile);
		let total = 0,
			wins = 0;
		for (let id = 1; id <= 100000; id++) {
			const round = generateMockRound(1, risk, id, appearance);
			auditRound(round);
			total += round.finalWin;
			wins += round.finalWin > 0 ? 1 : 0;
		}
		assert(Math.abs(total / 100000 - theory.rtp) < 6 * Math.sqrt(theory.variance / 100000));
		assert(
			Math.abs(wins / 100000 - theory.survival) <
				6 * Math.sqrt((theory.survival * (1 - theory.survival)) / 100000),
		);
		console.log(
			JSON.stringify({
				risk,
				theoreticalRtp: theory.rtp,
				observedRtp: total / 100000,
				survival: theory.survival,
			}),
		);
	});
}
test('all creatures and launch choices preserve base-game outcomes', () => {
	for (const risk of Object.keys(RISK_PROFILES))
		for (let id = 1; id <= 100; id++) {
			const baseline = generateMockRound(1.23, risk, id, appearance);
			for (const creature of CREATURES)
				for (const launchStyle of ['glide', 'boost', 'dive']) {
					const other = generateMockRound(1.23, risk, id, { creature: creature.id, launchStyle });
					assert.deepEqual(other.events, baseline.events);
					assert.equal(other.finalWin, baseline.finalWin);
				}
		}
});
test('all 13 forced development scenarios have consistent terminal events', () => {
	for (const scenario of DEV_SCENARIOS.filter((s) => s.id !== 'random'))
		for (const risk of Object.keys(RISK_PROFILES)) {
			auditRound(createDevFlightRound(scenario.id, { bet: 1.23, risk, roundId: 1, ...appearance }));
		}
});
test('creature steering stays finite and inside world bounds at common frame rates', () => {
	for (const width of [292, 390, 870, 1200])
		for (const height of [262, 650])
			for (const fps of [20, 30, 60, 120])
				for (const creature of CREATURES) {
					const bounds = { width, height, floorY: height - 34 };
					let player = createPlayer(bounds);
					for (let frame = 0; frame < fps * 4; frame++) {
						player = steerPlayer(
							player,
							frame < fps * 2 ? 20 : height - 10,
							1 / fps,
							bounds,
							creature,
						);
						assert(Number.isFinite(player.position.x) && Number.isFinite(player.position.y));
						assert(
							player.position.y >= player.radius &&
								player.position.y <= bounds.floorY - player.radius,
						);
					}
				}
});
test('all live artwork URLs resolve at root and under a deployment subpath', async () => {
	for (const base of ['', '/dragon-flight']) {
		const { CREATURES } = await load('creatures', { base });
		const { getLandscapeBackground, getFinishBackground } = await load('backgrounds', { base });
		const { getTerrainArtwork } = await load('terrainArtwork', { base });
		const { PICKUP_ARTWORK } = await load('pickupArtwork', { base });
		const { ENCOUNTER_ARTWORK } = await load('encounterArtwork', { base });
		const paths = new Set();
		for (const file of Object.values(ENCOUNTER_ARTWORK)) paths.add(file);
		for (const file of Object.values(PICKUP_ARTWORK)) paths.add(file);
		for (const creature of CREATURES)
			for (const file of creature.flightAnimation?.frames ?? []) paths.add(file);
		for (const weather of ['clear', 'rain', 'storm', 'fog', 'snow'])
			for (const time of ['dawn', 'day', 'sunset', 'night', 'eclipse']) {
				paths.add(getLandscapeBackground(weather, time));
				for (const ending of [
					'safeLanding',
					'meadowLanding',
					'ridgeLanding',
					'hiddenValley',
					'summitLanding',
				])
					paths.add(getFinishBackground(ending, weather, time));
			}
		for (const material of ['rock', 'tree'])
			for (const side of ['upper', 'lower'])
				for (const snow of [false, true]) {
					const art = getTerrainArtwork(material, side, snow);
					paths.add(art.src);
					paths.add(art.silhouette);
				}
		for (const name of ['day', 'dawn', 'sunset', 'night', 'eclipse', 'glide', 'boost', 'dive'])
			paths.add(`${base || '.'}/customize/${name}.webp`);
		for (const name of ['storm-run', 'summit-expedition'])
			paths.add(`${base || '.'}/bonuses/${name}.webp`);
		assert(paths.size >= 70, 'Missing expected artwork coverage');
		for (const file of paths) {
			assert(file.startsWith((base || '.') + '/'));
			assert(/\.(webp|png)$/.test(file));
			const bytes = fs.readFileSync(
				new URL('../static' + file.slice((base || '.').length), import.meta.url),
			);
			if (file.endsWith('.png'))
				assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
			else {
				assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
				assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
			}
		}
	}
});
