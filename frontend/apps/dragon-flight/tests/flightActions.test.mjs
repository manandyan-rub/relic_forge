import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { loadTypescript, transpile } from './typescript.mjs';
const { createBonusRound } = await loadTypescript(
	new URL('../src/game-world/bonusFlights.ts', import.meta.url),
);
const { createPlayer } = await loadTypescript(
	new URL('../src/game-world/physics.ts', import.meta.url),
);

const { createFlock, eliminateBird, startChampion } = await loadTypescript(
	new URL('../src/game-world/flock/presentation.ts', import.meta.url),
);
const { generateMockRound } = await loadTypescript(
	new URL('../src/game-world/mockRound.ts', import.meta.url),
);

const { createTubeFlight, tubeFlightOffer } = await loadTypescript(
	new URL('../src/game-world/tubeFlight.ts', import.meta.url),
);
const { menuFlightOffer } = await loadTypescript(
	new URL('../src/game-world/wagerPresentation.ts', import.meta.url),
);

const { runFlockTimeline, presentationKind } = await loadTypescript(
	new URL('../src/game-world/flock/director.ts', import.meta.url),
);
const { settleRoundOnce } = await loadTypescript(
	new URL('../src/game-world/flock/settlement.ts', import.meta.url),
);
const { easeOut } = await loadTypescript(
	new URL('../src/game-world/flock/timeline.ts', import.meta.url),
);
const { copyLineup, setLineupBird, attachLineup } = await loadTypescript(
	new URL('../src/game-world/flock/lineup.ts', import.meta.url),
);
const { attachHunter, planHunterAttack, hunterAttackFrame, applyHunterImpact, HUNTER_IMPACT } =
	await loadTypescript(new URL('../src/game-world/flock/mobilePresentation.ts', import.meta.url));
// Exercise the component's real action bodies, with only rendering/animation boundaries stubbed.
const source = fs.readFileSync(
	new URL('../src/game-world/GameWorld.svelte', import.meta.url),
	'utf8',
);
const actions = {};
for (const name of [
	'resetPresentation',
	'startFlight',
	'startTubeFlight',
	'displayedBetAmount',
	'startStakeFlight',
	'beginFlight',
	'chooseLineupBird',
	'flyAgain',
	'flyFromMenu',
	'playTubeFlight',
	'replayFlight',
	'presentFinalResult',
	'presentRound',
	'presentEncounter',
	'beginFlockEvent',
	'frameFlockEvent',
	'commitFlockEvent',
]) {
	const text = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\t}`))[0];
	actions[name] = await transpile(text);
}
function setup(ticket = 9999) {
	const ctx = {
		flightAudio: { play: () => {}, shot: () => {}, stop: () => {}, stopEffects: () => {} },
		resultSound: () => 'result-return',
		wallet: { live: false, ready: true, busy: false, active: false },
		status: 'ready',
		selectedBet: 1,
		betInput: '1.00',
		formatBetInput: (value) => value.toFixed(2),
		betInputIsValid: true,
		selectedRisk: 'safe',
		legacyCreatureId: 'archaeopteryx',
		selectedLaunchStyle: 'glide',
		selectedWeather: 'clear',
		selectedTimeOfDay: 'night',
		roundSequence: 0,
		presentationToken: 0,
		flightHistory: [],
		isReplay: false,
		bonusOpen: true,
		bounds: { width: 900, height: 520, floorY: 478 },
		createPlayer,
		createFlock,
		copyLineup,
		setLineupBird,
		attachLineup,
		attachHunter,
		planHunterAttack,
		hunterAttackFrame,
		applyHunterImpact,
		HUNTER_IMPACT,
		selectedHunter: 'forest',
		flightPlaybackSpeed: 1,
		selectedLineup: copyLineup(undefined),
		eliminateBird,
		startChampion,
		getCreature: (id) => ({ name: id }),
		ENDING_LABELS: {},
		ENCOUNTER_LABELS: { ridgeDragon: 'RIDGE DRAGON' },
		updateFlightProgress: () => {},
		enterStage: () => {},
		setLeadBody: () => {},
		player: createPlayer({ width: 900, height: 520, floorY: 478 }),
		triggerFlap: () => {},
		emitParticles: () => {},
		presentGate: async () => {},

		animateCurrentMultiplier: async () => {},
		showCombo: () => {},
		showWarning: async () => true,
		presentPickup: async () => {},
		presentCurrent: async () => {},
		presentEncounter: async () => {},
		presentEnding: async () => {},
		runFlockTimeline,
		presentationKind,
		settleRoundOnce,
		easeOut,
		pendingSettlements: new Map(),
		formatLocalAmount: (value) => `$${value.toFixed(2)}`,
		HAZARD_LABELS: {},
		PICKUP_LABELS: {},
		CURRENT_LABELS: {},
		createPresentedGate: (event) => ({
			...event,
			x: 1000,
			width: 100,
			gapCenterY: 240,
			gapHeight: 200,
		}),
		timeline: {
			animate: async (_duration, _token, update) => {
				for (const p of [0, 0.2, 0.4, 0.55, 0.75, 1]) update?.(p);
				return true;
			},
		},
		generateMockRound,
		createTubeFlight,
		tubeFlightOffer,
		minimumBet: 0.1,
		maximumBet: 10000,
		window: { matchMedia: () => ({ matches: true }) },
		delay: async () => {},
		createBonusRound,
		drawBonusTicket: () => ticket,
		getFinishBackground: () => '/finish.webp',
		decodeScene: () => Promise.resolve(),
		cancelPresentation: () => {},
		Image: class {
			decode() {
				return Promise.resolve();
			}
		},
		getWinTier: (multiple) => ({ label: multiple >= 2 ? 'WIN' : 'RESULT', duration: 0 }),
		animatePresentationValues: async (_duration, update) => update(1),
	};
	Object.defineProperty(ctx, 'controlsLocked', { get: () => ctx.status !== 'ready' });
	Object.defineProperty(ctx, 'menuOffer', {
		get: () => menuFlightOffer(ctx.currentRound, ctx.status, ctx.selectedBet),
	});
	const scope = new Proxy(ctx, {
		has: () => true,
		get: (target, key) =>
			key === Symbol.unscopables ? undefined : key in target ? target[key] : globalThis[key],
		set: (target, key, value) => {
			target[key] = value;
			return true;
		},
	});
	for (const [name, js] of Object.entries(actions)) {
		ctx[name] = new Function('scope', `with(scope){ return (${js}); }`)(scope);
	}
	ctx.runRound = ctx.presentRound;
	ctx.presentRound = () => {};
	ctx.runEncounter = ctx.presentEncounter;
	ctx.presentEncounter = () => {};
	return ctx;
}
test('buy locks controls, repeated click cannot generate another round, and history records once', async () => {
	const ctx = setup();
	ctx.startFlight('storm-run');
	assert.equal(ctx.status, 'flying');
	assert.equal(ctx.currentRound.entryCost, 20);
	assert.equal(ctx.bonusOpen, false);
	ctx.startFlight('summit-expedition');
	assert.equal(ctx.roundSequence, 1);
	assert.equal(ctx.currentRound.bonusFlight, 'storm-run');
	await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	assert.equal(ctx.flightHistory.length, 1);
	assert.equal(ctx.finalWin, 300);
});

test('hunter hit animation never decides survival; only the scheduled elimination does', async () => {
	const ctx = setup();
	ctx.startFlight();
	const before = ctx.activeBirds.map((bird) => ({ id: bird.id, alive: bird.alive }));
	const elimination = { type: 'elimination', bird: 'woodpecker', reason: 'hunter' };
	ctx.beginFlockEvent(elimination, 1);
	ctx.frameFlockEvent(elimination, 0.4);
	assert.deepEqual(
		ctx.activeBirds.map((b) => ({ id: b.id, alive: b.alive })),
		before,
	);
	await ctx.runRound(ctx.currentRound, ctx.presentationToken);
	assert.equal(
		ctx.activeBirds.filter((bird) => bird.alive).length,
		ctx.currentRound.flock.survivors,
	);
	assert(
		ctx.activeBirds
			.filter((bird) => !bird.alive)
			.every((bird) => bird.elimination.reason === 'hunter'),
	);
	assert.equal(ctx.hunterShot, undefined);
});
test('history replay keeps original outcome, charges no new entry and never duplicates history', async () => {
	const ctx = setup(0);
	ctx.startFlight('summit-expedition');
	const original = ctx.currentRound;
	await ctx.presentFinalResult(original, ctx.presentationToken);
	ctx.replayFlight(original);
	assert.equal(ctx.isReplay, true);
	assert.equal(ctx.currentRound, original);
	assert.equal(ctx.roundSequence, 1);
	await ctx.presentFinalResult(original, ctx.presentationToken);
	assert.equal(ctx.finalWin, 0);
	assert.equal(ctx.flightHistory.length, 1);
});
test('Buy Again starts one fresh round at the same price without changing normal flight settings', async () => {
	const ctx = setup();
	ctx.startFlight('summit-expedition');
	await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	ctx.drawBonusTicket = () => 0;
	ctx.flyAgain();
	assert.equal(ctx.roundSequence, 2);
	assert.equal(ctx.currentRound.entryCost, 50);
	assert.equal(ctx.currentRound.finalWin, 0);
	assert.equal(ctx.isReplay, false);
	assert.equal(ctx.selectedRisk, 'safe');
	assert.equal(ctx.selectedWeather, 'clear');
	assert.equal(ctx.selectedTimeOfDay, 'night');
});

test('main menu displays the full repeated feature cost and places exactly that wager', async () => {
	for (const [mode, cost] of [
		['storm-run', 20],
		['summit-expedition', 50],
	]) {
		const ctx = setup();
		assert.deepEqual(ctx.menuOffer, { bonusFlight: undefined, cost: 1, label: 'fly' });
		ctx.startFlight(mode);
		assert.equal(ctx.menuOffer.cost, cost);
		await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
		const offered = ctx.menuOffer;
		assert.equal(offered.label, 'buyAgain');
		assert.equal(offered.cost, cost);
		ctx.flyFromMenu();
		assert.equal(ctx.currentRound.entryCost, offered.cost);
		assert.equal(ctx.currentRound.bonusFlight, offered.bonusFlight);
		assert.equal(ctx.roundSequence, 2);
	}
});

test('hunter final impact survives a coarse tick and dead targets cannot be shot again', () => {
	const ctx = setup();
	ctx.startFlight();
	const event = { type: 'elimination', bird: 'eagle', reason: 'hunter' };
	let shots = 0;
	ctx.flightAudio.shot = () => shots++;
	ctx.beginFlockEvent(event, 1);
	ctx.frameFlockEvent(event, 0.82);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').alive, true);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').hitFlash, 0.12);
	assert.equal(ctx.hunterShot.progress, 1);
	const velocity = ctx.activeBirds.find((b) => b.id === 'eagle').body.velocity;
	ctx.frameFlockEvent(event, 0.84);
	assert.deepEqual(ctx.activeBirds.find((b) => b.id === 'eagle').body.velocity, velocity);
	ctx.commitFlockEvent(event);
	const count = shots;
	ctx.frameFlockEvent(event, 0.95);
	assert.equal(ctx.hunterShot, undefined);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').alive, false);
	assert.equal(shots, count);
});

test('legacy predator effects finish through the shared clock and preserve the authored outcome', async () => {
	for (const result of ['pass', 'crash']) {
		const ctx = setup();
		ctx.startFlight('storm-run');
		const round = ctx.currentRound;
		const finances = [round.finalWin, round.finalMultiplier, round.entryCost];
		const multiplier = result === 'pass' ? 2.5 : 0;
		ctx.animateCurrentMultiplier = async (value) => (ctx.currentMultiplier = value);
		await ctx.runEncounter(
			{ type: 'encounter', encounterType: 'ridgeDragon', result, multiplier },
			ctx.presentationToken,
		);
		assert.equal(ctx.currentMultiplier, multiplier);
		assert.equal(ctx.activeEncounter, undefined);
		assert.equal(
			ctx.activeBirds.find((bird) => bird.id === round.creature).alive,
			result === 'pass',
		);
		assert.equal(ctx.eventCallout, result === 'pass' ? 'PREDATOR AVOIDED' : 'PREDATOR STRIKE');
		assert.deepEqual([round.finalWin, round.finalMultiplier, round.entryCost], finances);
	}
});

test('legacy crash feather effect completes or cancels without media callbacks or settlement', async () => {
	for (const cancelled of [false, true]) {
		const ctx = setup(0);
		ctx.startFlight('storm-run');
		const round = ctx.currentRound;
		let settled = 0;
		ctx.wallet.live = true;
		ctx.settledRounds = new Set();
		ctx.stakeSession = { settle: async () => settled++ };
		if (cancelled) ctx.timeline.animate = async () => false;
		await ctx.runRound(round, ctx.presentationToken);
		assert.equal(settled, cancelled ? 0 : 1);
		assert.equal(ctx.birdBurst, cancelled ? 'playing' : 'finished');
		assert.equal(ctx.status === 'complete', !cancelled);
		if (!cancelled) {
			assert.equal(ctx.birdBurstProgress, 1);
			assert.equal(ctx.activeBirds[0].alive, false);
			assert.equal(ctx.finalWin, round.finalWin);
		}
	}
});
test('history caps at 20 completed flights and rejects replay during an active flight', async () => {
	const ctx = setup();
	for (let i = 0; i < 25; i++) {
		ctx.resetPresentation();
		ctx.startFlight('storm-run');
		await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	}
	assert.equal(ctx.flightHistory.length, 20);
	assert.equal(ctx.flightHistory[0].id, 25);
	assert.equal(ctx.flightHistory.at(-1).id, 6);
	ctx.resetPresentation();
	ctx.startFlight('storm-run');
	const active = ctx.currentRound;
	ctx.replayFlight(ctx.flightHistory[0]);
	assert.equal(ctx.currentRound, active);
	assert.equal(ctx.isReplay, false);
});
test('randomness failure leaves the flight ready and reports an error', () => {
	const ctx = setup();
	ctx.drawBonusTicket = () => {
		throw new Error('unavailable');
	};
	ctx.startFlight('storm-run');
	assert.equal(ctx.status, 'ready');
	assert.equal(ctx.currentRound, undefined);
	assert(ctx.flightError);
});

test('normal flock locks repeated Fly, records exact outcome once and replays without new entry', async () => {
	const ctx = setup();
	ctx.startFlight();
	const round = ctx.currentRound;
	assert.equal(round.flock.birds.length, 4);
	assert.equal(ctx.activeBirds.length, 4);
	ctx.startFlight();
	assert.equal(ctx.roundSequence, 1);
	assert.equal(ctx.currentRound, round);
	await ctx.runRound(round, ctx.presentationToken);
	assert.equal(ctx.status, 'complete');
	assert.equal(ctx.flightHistory.length, 1);
	ctx.replayFlight(round);
	assert.equal(ctx.currentRound, round);
	assert.equal(ctx.roundSequence, 1);
	await ctx.runRound(round, ctx.presentationToken);
	assert.equal(ctx.flightHistory.length, 1);
	assert.equal(ctx.finalWin, round.finalWin);
});
test('Champion sequencing settles one paid round and preserves base return after a bonus loss', async () => {
	for (const ending of ['summitLanding', 'crash']) {
		const ctx = setup();
		let round;
		for (let id = 1; id < 10000; id++) {
			const candidate = generateMockRound(1, 'balanced', id, {
				creature: 'eagle',
				launchStyle: 'boost',
			});
			if (candidate.flock.bonus?.ending === ending) {
				round = candidate;
				break;
			}
		}
		assert(round);
		ctx.wallet.live = true;
		ctx.settledRounds = new Set();
		let settlements = 0;
		ctx.stakeSession = {
			settle: async () => {
				settlements++;
			},
		};
		ctx.beginFlight(round);
		await ctx.runRound(round, ctx.presentationToken);
		assert.equal(ctx.championActive, true);
		assert.equal(ctx.focusBirdId, 'archaeopteryx');
		assert.equal(ctx.activeBirds.filter((b) => !b.exiting).length, 1);
		assert.equal(ctx.roundSequence, 0);
		assert.equal(ctx.finalWin, round.finalWin);
		assert.equal(ctx.flightHistory.length, 1);
		assert.equal(settlements, 1);
		await ctx.presentFinalResult(round, ctx.presentationToken);
		assert.equal(settlements, 1);
		ctx.replayFlight(round);
		await ctx.runRound(round, ctx.presentationToken);
		assert.equal(settlements, 1);
		assert.equal(ctx.flightHistory.length, 1);
		if (ending === 'crash') {
			assert.equal(ctx.finalWin, round.flock.baseMultiplier * round.bet);
			assert.equal(ctx.eventCallout, 'BONUS FAILED · BASE WIN RETAINED');
			assert.equal(ctx.activeBirds.find((b) => b.id === 'archaeopteryx').alive, false);
		} else
			assert.equal(
				ctx.eventCallout,
				`BONUS WON · +$${(round.bet * round.flock.bonus.multiplier).toFixed(2)}`,
			);
		assert.equal(ctx.finalMultiplier, round.finalMultiplier);
	}
});

test('hunter win unlocks one half-net-profit Fluppy attempt; result cannot restart it', async () => {
	const ctx = setup();
	const hunter = generateMockRound(1, 'balanced', 2, { creature: 'eagle', launchStyle: 'glide' });
	assert.equal(hunter.finalWin, 6.25);
	ctx.roundSequence = 2;
	ctx.beginFlight(hunter);
	await ctx.presentFinalResult(hunter, ctx.presentationToken);
	ctx.playTubeFlight();
	const fluppy = ctx.currentRound;
	assert.equal(fluppy.route, 'tube-flight');
	assert.equal(fluppy.flock, undefined);
	assert.equal(fluppy.bet, 2.62);
	assert.equal(ctx.selectedBet, hunter.bet);
	assert.equal(ctx.betInput, '1.00');
	assert.equal(ctx.displayedBetAmount(), fluppy.bet);
	assert.equal(ctx.menuOffer.cost, fluppy.bet);
	ctx.playTubeFlight();
	assert.equal(ctx.currentRound, fluppy);
	assert.equal(ctx.roundSequence, 3);
	await ctx.presentFinalResult(fluppy, ctx.presentationToken);
	assert.equal(ctx.displayedBetAmount(), hunter.bet);
	assert.equal(ctx.menuOffer.cost, hunter.bet);
	assert.equal(ctx.flightHistory.length, 2);
	assert.equal(ctx.flightHistory[1], hunter);
	ctx.playTubeFlight();
	assert.equal(ctx.roundSequence, 3);
	ctx.flyAgain();
	assert.equal(ctx.status, 'ready');
	assert.equal(ctx.roundSequence, 3);
	ctx.startFlight();
	assert(ctx.currentRound.flock);
	assert.equal(ctx.currentRound.route, undefined);
	assert.equal(ctx.currentRound.bet, hunter.bet);
});

test('Fluppy wins and losses preserve the hunter bet for immediate main Fly and Return', async () => {
	for (const win of [false, true]) {
		for (const returnWith of ['flyFromMenu', 'resetPresentation', 'flyAgain']) {
			const ctx = setup();
			const hunter = generateMockRound(1, 'balanced', 2, {
				creature: 'eagle',
				launchStyle: 'glide',
			});
			const amount = tubeFlightOffer(hunter, 0.1, 10000, false, false).amount;
			let nextId = 3;
			while (createTubeFlight(hunter, amount, nextId).finalWin > 0 !== win) nextId++;
			ctx.roundSequence = nextId - 1;
			ctx.beginFlight(hunter);
			await ctx.presentFinalResult(hunter, ctx.presentationToken);
			ctx.playTubeFlight();
			const fluppy = ctx.currentRound;
			assert.equal(fluppy.finalWin > 0, win);
			assert.equal(fluppy.bet, amount);
			assert.equal(ctx.selectedBet, 1);
			assert.equal(ctx.betInput, '1.00');
			assert.equal(ctx.displayedBetAmount(), amount);
			await ctx.presentFinalResult(fluppy, ctx.presentationToken);
			assert.equal(ctx.displayedBetAmount(), 1);
			assert.equal(ctx.menuOffer.cost, 1);
			assert.equal(ctx.finalWin, fluppy.finalWin);
			assert.equal(ctx.flightHistory.length, 2);
			ctx[returnWith]();
			if (returnWith !== 'flyFromMenu') {
				assert.equal(ctx.status, 'ready');
				assert.equal(ctx.selectedBet, 1);
				assert.equal(ctx.betInput, '1.00');
				ctx.startFlight();
			}
			assert(ctx.currentRound.flock);
			assert.equal(ctx.currentRound.route, undefined);
			assert.equal(ctx.currentRound.bet, 1);
		}
	}
});

test('Fluppy history replay displays its original bet without replacing the current hunter preference', async () => {
	const ctx = setup();
	const hunter = generateMockRound(1, 'balanced', 2, { creature: 'eagle', launchStyle: 'glide' });
	ctx.roundSequence = 2;
	ctx.beginFlight(hunter);
	await ctx.presentFinalResult(hunter, ctx.presentationToken);
	ctx.playTubeFlight();
	const fluppy = ctx.currentRound;
	await ctx.presentFinalResult(fluppy, ctx.presentationToken);
	ctx.resetPresentation();
	ctx.selectedBet = 9.75;
	ctx.betInput = '9.75';
	ctx.replayFlight(fluppy);
	assert.equal(ctx.displayedBetAmount(), fluppy.bet);
	assert.equal(ctx.menuOffer.cost, fluppy.bet);
	assert.equal(ctx.selectedBet, 9.75);
	assert.equal(ctx.betInput, '9.75');
	await ctx.presentFinalResult(fluppy, ctx.presentationToken);
	assert.equal(ctx.displayedBetAmount(), 9.75);
	assert.equal(ctx.menuOffer.cost, 9.75);
	assert.equal(ctx.flightHistory.length, 2);
	assert.equal(ctx.roundSequence, 3);
	ctx.playTubeFlight();
	assert.equal(ctx.currentRound, fluppy);
	assert.equal(ctx.roundSequence, 3);
	ctx.resetPresentation();
	assert.equal(ctx.selectedBet, 9.75);
	assert.equal(ctx.betInput, '9.75');
});

test('a failed or connected Fluppy start cannot replace the hunter bet', async () => {
	for (const live of [false, true]) {
		const ctx = setup();
		const hunter = generateMockRound(1, 'balanced', 2, { creature: 'eagle', launchStyle: 'glide' });
		ctx.beginFlight(hunter);
		await ctx.presentFinalResult(hunter, ctx.presentationToken);
		ctx.wallet.live = live;
		const original = ctx.currentRound;
		ctx.createTubeFlight = () => {
			throw new Error('unavailable');
		};
		ctx.playTubeFlight();
		assert.equal(ctx.selectedBet, 1);
		assert.equal(ctx.betInput, '1.00');
		assert.equal(ctx.displayedBetAmount(), 1);
		assert.equal(ctx.flightHistory.length, 1);
		if (live) assert.equal(ctx.currentRound, original);
		else {
			assert.equal(ctx.status, 'ready');
			assert.equal(ctx.currentRound, undefined);
			assert(ctx.flightError);
		}
	}
});

test('Fluppy offer rejects losses, history replays and invalid or connected stakes', () => {
	const round = generateMockRound(1, 'balanced', 2, { creature: 'eagle', launchStyle: 'glide' });
	assert.equal(tubeFlightOffer(round, 0.1, 10000, false, false).amount, 2.62);
	assert.equal(tubeFlightOffer(round, 0.1, 10000, false, true), undefined);
	assert.equal(tubeFlightOffer({ ...round, finalWin: 0.8 }, 0.1, 10000, false, false), undefined);
	assert(tubeFlightOffer(round, 5, 10000, false, false).reason);
	assert(tubeFlightOffer(round, 0.1, 2, false, false).reason);
	assert(tubeFlightOffer(round, 0.1, 10000, true, false).reason);
	const fluppy = createTubeFlight(round, 2.62, 3);
	assert.equal(tubeFlightOffer(fluppy, 0.1, 10000, false, false), undefined);
});

test('main Fly starts a fresh hunter round from inline results and never repeats Fluppy', async () => {
	const ctx = setup();
	ctx.startFlight();
	await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	ctx.flyFromMenu();
	assert.equal(ctx.roundSequence, 2);
	assert.equal(ctx.status, 'flying');
	assert(ctx.currentRound.flock);
	ctx.flyFromMenu();
	assert.equal(ctx.roundSequence, 2);
	await ctx.presentFinalResult(ctx.currentRound, ctx.presentationToken);
	const fluppy = createTubeFlight(ctx.currentRound, 1, 3);
	ctx.resetPresentation();
	ctx.beginFlight(fluppy);
	await ctx.presentFinalResult(fluppy, ctx.presentationToken);
	ctx.flyFromMenu();
	assert(ctx.currentRound.flock);
	assert.equal(ctx.currentRound.route, undefined);
});

test('non-hunter elimination effects preserve the authored cause and other birds', () => {
	for (const reason of ['terrain', 'wind', 'predator']) {
		const ctx = setup();
		ctx.startFlight();
		const event = { type: 'elimination', bird: 'eagle', reason };
		ctx.beginFlockEvent(event, 1);
		ctx.frameFlockEvent(event, 0.4);
		assert.equal(ctx.hunterShot, undefined);
		assert(ctx.activeBirds.every((b) => b.alive));
		ctx.commitFlockEvent(event);
		assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').elimination.reason, reason);
		assert.equal(ctx.activeBirds.filter((b) => b.alive).length, 3);
	}
});

test('stale result cannot settle or alter the following round', async () => {
	const ctx = setup();
	ctx.startFlight();
	const round = ctx.currentRound;
	ctx.wallet.live = true;
	ctx.settledRounds = new Set();
	let calls = 0;
	ctx.stakeSession = {
		settle: async () => {
			calls++;
		},
	};
	await ctx.presentFinalResult(round, ctx.presentationToken - 1);
	assert.equal(calls, 0);
	assert.equal(ctx.flightHistory.length, 0);
	assert.equal(ctx.status, 'flying');
});

test('late live play response cannot start a stale presentation after cancellation', async () => {
	const ctx = setup();
	let resolve;
	let calls = 0;
	ctx.stakeAmount = 1000000;
	ctx.stakeSession = {
		play: () => {
			calls++;
			return new Promise((done) => (resolve = done));
		},
	};
	const pending = ctx.startStakeFlight();
	ctx.presentationToken++;
	resolve({});
	await pending;
	assert.equal(calls, 1);
	assert.equal(ctx.currentRound, undefined);
	assert.equal(ctx.status, 'ready');
});

test('custom four-bird lineup is locked during flight and saved for history replay', async () => {
	const ctx = setup();
	ctx.chooseLineupBird(1, 'woodpecker');
	ctx.chooseLineupBird(3, 'eagle');
	assert.deepEqual(ctx.selectedLineup, ['woodpecker', 'woodpecker', 'eagle', 'eagle']);
	ctx.startFlight();
	const round = ctx.currentRound;
	assert.deepEqual(round.lineup, ctx.selectedLineup);
	assert.deepEqual(
		ctx.activeBirds.map((b) => b.species),
		round.lineup,
	);
	ctx.chooseLineupBird(0, 'azure-swift');
	assert.equal(ctx.selectedLineup[0], 'woodpecker');
	await ctx.runRound(round, ctx.presentationToken);
	ctx.selectedLineup = copyLineup(undefined);
	ctx.replayFlight(round);
	assert.deepEqual(ctx.currentRound.lineup, ['woodpecker', 'woodpecker', 'eagle', 'eagle']);
	assert.deepEqual(
		ctx.activeBirds.map((b) => b.species),
		round.lineup,
	);
	await ctx.runRound(round, ctx.presentationToken);
	assert.equal(ctx.flightHistory.length, 1);
	assert.equal(ctx.finalWin, round.finalWin);
});

test('hunter incident feedback and cosmetic replay follow the same authored casino result', async () => {
	const ctx = setup();
	ctx.selectedHunter = 'ranger';
	ctx.selectedRisk = 'danger';
	ctx.startFlight();
	const round = ctx.currentRound;
	assert.equal(round.hunter, 'ranger');
	const financials = [round.finalWin, round.finalMultiplier, round.entryCost];
	const elimination = { type: 'elimination', bird: 'eagle', reason: 'hunter' };
	ctx.beginFlockEvent(elimination, 1);
	ctx.frameFlockEvent(elimination, 0.65);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').alive, true);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').hitFlash, 0.12);
	ctx.commitFlockEvent(elimination);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').alive, false);
	await ctx.presentFinalResult(round, ctx.presentationToken);
	ctx.selectedHunter = 'forest';
	ctx.replayFlight(round);
	assert.equal(ctx.currentRound.hunter, 'ranger');
	assert.deepEqual([round.finalWin, round.finalMultiplier, round.entryCost], financials);
	assert.equal(ctx.activeBirds.find((b) => b.id === 'eagle').alive, true);
	assert(ctx.activeBirds.every((bird) => !('health' in bird) && !('maxHealth' in bird)));
});
