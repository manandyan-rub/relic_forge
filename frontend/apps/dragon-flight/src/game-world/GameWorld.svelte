<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		LANGUAGE_NAMES,
		SUPPORTED_LANGUAGES,
		changeLanguage,
		getRiskNote,
		language,
		stageWord,
		t,
		textDirection,
	} from './i18n';
	import {
		StakeSession,
		initialWallet,
		decodeStakeRound,
		loadStakeReplay,
		isValidStakeBet,
		stakeBetUnits,
	} from './stake';
	let wallet = $state(initialWallet());
	const settledRounds = new SvelteSet<number>();
	let stakeSession: StakeSession;
	let replayMode = $state(false);
	let sharedReplay = $state<FlightRound>();
	function formatLocalAmount(value: number) {
		return formatAmount(value, wallet.live ? wallet.currency : 'USD');
	}
	function formatBetInput(value: number) {
		const step = wallet.live ? wallet.stepBet / 1e6 : PROTOTYPE_BET_STEP;
		const stepDecimals = (step.toFixed(6).match(/\.(\d*?[1-9])0*$/)?.[1] ?? '').length;
		return value.toFixed(Math.max(2, stepDecimals));
	}
	function getCurrencySymbol(currency: string) {
		return (
			new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency,
				currencyDisplay: 'narrowSymbol',
			})
				.formatToParts(0)
				.find((part) => part.type === 'currency')?.value ?? currency
		);
	}
	async function connectStake() {
		const token = presentationToken;
		flightError = '';
		if (new URLSearchParams(window.location.search).get('replay') === 'true') {
			replayMode = true;
			wallet = { ...wallet, busy: true };
			try {
				const loaded = await loadStakeReplay(window.location.search);
				if (token !== presentationToken) return;
				sharedReplay = loaded.round;
				wallet = { ...wallet, live: true, ready: true, currency: loaded.currency, error: '' };
			} catch (error) {
				if (token !== presentationToken) return;
				wallet = {
					...wallet,
					ready: false,
					error: error instanceof Error ? error.message : 'Replay failed',
				};
			}
			wallet = { ...wallet, busy: false };
			return;
		}
		const recovered = await stakeSession.connect(window.location.search, import.meta.env.DEV);
		if (token !== presentationToken) return;
		if (!wallet.ready) return;
		if (wallet.live) {
			selectedBet = wallet.defaultBet / 1e6;
			betInput = formatBetInput(selectedBet);
			if (wallet.turboDisabled) playbackSpeed = 1;
		}
		if (recovered) {
			try {
				const round = decodeStakeRound(recovered, {
					creature: legacyCreatureId,
					launchStyle: selectedLaunchStyle,
				});
				resetPresentation();
				beginFlight(round);
			} catch (error) {
				stakeSession.block(error);
			}
		} else if (currentRound && !isReplay && status !== 'ready' && status !== 'complete') {
			await presentFinalResult(currentRound, presentationToken);
		}
	}
	async function startStakeFlight(bonusId?: BonusFlightId) {
		const token = presentationToken;
		try {
			const response = await stakeSession.play(bonusId ?? selectedRisk, stakeAmount);
			if (token !== presentationToken) return;
			let round: FlightRound;
			try {
				round = decodeStakeRound(response, {
					creature: legacyCreatureId,
					launchStyle: selectedLaunchStyle,
				});
			} catch (error) {
				stakeSession.block(error);
				return;
			}
			if (!bonusId) {
				round.weather = selectedWeather;
				round.timeOfDay = selectedRisk === 'safe' ? 'day' : selectedTimeOfDay;
			}
			bonusOpen = false;
			beginFlight(round);
		} catch (error) {
			if (token === presentationToken)
				flightError = error instanceof Error ? error.message : 'Could not start flight';
		}
	}
	import { FlightAudio, resultSound } from './audio';
	const flightAudio = new FlightAudio();
	let soundMuted = $state(false);
	let previousPanels = '';

	function toggleSound() {
		soundMuted = !soundMuted;
		flightAudio.setMuted(soundMuted);
		if (!soundMuted) flightAudio.unlock();
		try {
			localStorage.setItem('dragon-flight-muted', String(soundMuted));
		} catch {
			/* Optional preference. */
		}
	}
	$effect(() => {
		flightAudio.setWeather(sceneWeather);
	});
	$effect(() => {
		const animation = activeCreature.flightAnimation;
		flightAudio.setWingLoop(
			status === 'flying' || (status === 'ending' && !landed),
			animation ? animation.frameOrder.length / animation.fps : 0.8,
		);
	});
	$effect(() => {
		const panels = [customizeOpen, helpOpen, bonusOpen, historyOpen].join(',');
		if (previousPanels && panels !== previousPanels)
			void flightAudio.play('option-select', 0.22, 'ui');
		previousPanels = panels;
	});
	import { ENCOUNTER_ARTWORK } from './encounterArtwork';
	import { PICKUP_ARTWORK } from './pickupArtwork';
	// Standalone local Lucky Flight prototype.
	import {
		INITIAL_BOUNDS,
		MAX_PROTOTYPE_BET,
		MIN_PROTOTYPE_BET,
		PATHS,
		PROTOTYPE_BET_STEP,
		WORLD_SPEED,
		GATE_APPROACH_RATE,
	} from './config';
	import { clamp, createPlayer } from './physics';
	import { generateMockRound } from './mockRound';
	import { createTubeFlight, tubeFlightOffer } from './tubeFlight';
	import { createBonusRound, drawBonusTicket } from './bonusFlights';
	import { menuFlightOffer } from './wagerPresentation';
	import BonusFlightsDialog from './components/BonusFlightsDialog.svelte';
	import FlightHistory from './components/FlightHistory.svelte';
	import { CREATURES, getCreature, loadDecodedFlightFrames } from './creatures';
	import { getFlightStage, stageForEventIndex } from './stages';
	import {
		ENCOUNTER_LABELS,
		getWinTier,
		CURRENT_LABELS,
		PICKUP_LABELS,
		ENDING_LABELS,
		HAZARD_LABELS,
	} from './presentation';
	import { getWeather } from './weather';
	import { getTimeOfDay } from './timeOfDay';
	import { getFinishBackground, LANDING_ANCHOR } from './backgrounds';
	import { decodeScene } from './sceneCache';
	import { clampBet, isBetInputValid, roundBet, sanitizeBetInput } from './utils/bet';
	import { createWinAmountFormatter, formatLocalAmount as formatAmount } from './utils/format';
	import Atmosphere from './components/Atmosphere.svelte';
	import Landscape from './components/Landscape.svelte';
	import DangerEncounter from './components/DangerEncounter.svelte';
	import BirdBurst from './components/BirdBurst.svelte';
	import Flock from './components/Flock.svelte';
	import { copyLineup, setLineupBird, attachLineup } from './flock/lineup';
	import type { FlockLineup } from './flock/types';
	import Hunter from './components/Hunter.svelte';
	import type { HunterShot } from './flock/hunter';
	import {
		attachHunter,
		planHunterAttack,
		hunterAttackFrame,
		applyHunterHealth,
		type HunterAppearance,
		type HunterAttack,
	} from './flock/mobilePresentation';
	import FlockStatus from './components/FlockStatus.svelte';
	import ChampionFlight from './components/ChampionFlight.svelte';
	import {
		createFlock,
		stepFlock,
		eliminateBird,
		startChampion,
		resizeFlock,
		updateBirdBody,
	} from './flock/presentation';
	import { PresentationTimeline, easeOut, presentationSpeed } from './flock/timeline';
	import { settleRoundOnce } from './flock/settlement';
	import { runFlockTimeline, presentationKind } from './flock/director';
	import CustomizeDrawer from './components/CustomizeDrawer.svelte';
	import EndingEffect from './components/EndingEffect.svelte';
	import TerrainObstacle from './components/TerrainObstacle.svelte';
	import { getTerrainVisualWidth } from './terrainArtwork';
	import FlightResult from './components/FlightResult.svelte';
	import EventWarning from './components/EventWarning.svelte';
	import HelpDialog from './components/HelpDialog.svelte';
	import AirCurrentEffect from './components/AirCurrentEffect.svelte';
	import CollectiblePickup from './components/CollectiblePickup.svelte';
	import WinCelebration from './components/WinCelebration.svelte';
	import type {
		BonusFlightId,
		ActiveEncounterPresentation,
		ActiveGate,
		ActiveCurrentPresentation,
		ActivePickupPresentation,
		CreatureId,
		ComboPresentation,
		FlightParticle,
		FlightEnding,
		FlightEvent,
		FlightRisk,
		FlightRound,
		FlightStageId,
		LaunchStyle,
		PlayerBody,
		PrototypeStatus,
		StageAnnouncement,
		WarningPresentation,
		WorldBounds,
		WeatherCondition,
		TimeOfDay,
	} from './types';

	let worldElement = $state<HTMLDivElement>();
	let bounds = $state<WorldBounds>(INITIAL_BOUNDS);
	let selectedLineup = $state<FlockLineup>(copyLineup(undefined));
	let activeBirds = $state(createFlock(INITIAL_BOUNDS));
	let focusBirdId = $state<CreatureId>('archaeopteryx');
	let championActive = $state(false);
	let hunterShot = $state<HunterShot>();
	let selectedHunter = $state<HunterAppearance>('forest');
	let hunterAttack: HunterAttack | undefined;
	let hunterShotIndex = -1;
	let championAnnouncement = $state(false);
	let flockAnnouncement = $state('');
	const player = $derived(
		activeBirds.find((bird) => bird.id === focusBirdId)?.body ?? createPlayer(bounds),
	);
	function chooseLineupBird(slot: number, species: CreatureId) {
		if (controlsLocked || wallet.busy || wallet.active) return;
		selectedLineup = setLineupBird(selectedLineup, slot, species);
		activeBirds = createFlock(bounds, undefined, selectedLineup);
	}
	function setLeadBody(body: PlayerBody) {
		activeBirds = updateBirdBody(activeBirds, focusBirdId, body);
	}
	let selectedBet = $state(1);
	let betInput = $state('1.00');
	const betCurrencySymbol = $derived(getCurrencySymbol(wallet.live ? wallet.currency : 'USD'));
	let selectedRisk = $state<FlightRisk>('safe');
	const legacyCreatureId: CreatureId = 'archaeopteryx';
	let selectedLaunchStyle = $state<LaunchStyle>('glide');
	const selectedWeather = $derived<WeatherCondition>(
		selectedRisk === 'safe' ? 'clear' : selectedRisk === 'balanced' ? 'rain' : 'storm',
	);
	let selectedTimeOfDay = $state<TimeOfDay>('day');
	let playbackSpeed = $state(1.5);
	let customizeOpen = $state(false);
	let helpOpen = $state(false);
	let settingsMenuOpen = $state(false);
	async function toggleFullscreen() {
		if (wallet.fullscreenDisabled) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			/* Fullscreen may be unavailable in the host frame. */
		}
	}
	let bonusOpen = $state(false);
	let historyOpen = $state(false);
	let flightHistory = $state<FlightRound[]>([]);
	let isReplay = $state(false);
	let flightError = $state('');
	let currentStageId = $state<FlightStageId>('MOUNTAIN_VALLEY');
	let flightProgress = $state(0);
	let stageAnnouncement = $state<StageAnnouncement>();
	let status = $state<PrototypeStatus>('ready');
	let currentRound = $state<FlightRound>();
	const menuOffer = $derived(menuFlightOffer(currentRound, status, selectedBet));
	let currentMultiplier = $state(1);
	let finalMultiplier = $state(0);
	let finalWin = $state(0);
	const winAmountFormatter = $derived(
		createWinAmountFormatter(currentRound?.finalWin ?? 0, wallet.currency),
	);
	let winCelebrationOpen = $state(false);
	// Retain round telemetry without displaying it in the permanent HUD.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let gatesPassed = $state(0);
	let distanceTravelled = $state(0);
	let activeGate = $state<ActiveGate>();
	let activePickup = $state<ActivePickupPresentation>();
	let activeCurrent = $state<ActiveCurrentPresentation>();
	let activeEncounter = $state<ActiveEncounterPresentation>();
	let birdBurst = $state<'playing' | 'finished'>();
	let birdBurstProgress = $state(0);
	let activeEnding = $state<Exclude<FlightEnding, 'crash'>>();
	let landingProgress = $state(0);
	let eventWarning = $state<WarningPresentation>();
	let comboFeedback = $state<ComboPresentation>();
	let comboCount = $state(0);
	let multiplierPulse = $state(false);
	let loadedCreatureFrames = $state<Partial<Record<CreatureId, readonly ImageBitmap[]>>>({});
	let impactActive = $state(false);
	let eventLabel = $state('READY');
	let eventProgress = $state(0);
	let eventCallout = $state('');
	let flightTargetY = $state(INITIAL_BOUNDS.floorY * 0.5);
	let particles = $state<FlightParticle[]>([]);
	let parallaxOffset = $state(0);
	let roundSequence = 0;
	let presentationToken = 0;
	let particleSequence = 0;
	let stageAnnouncementSequence = 0;
	let warningSequence = 0;
	let comboSequence = 0;
	let gateResolver: (() => void) | undefined;
	const timeline = new PresentationTimeline();
	const pendingSettlements = new Map<number, Promise<void>>();
	let flockEventStartMultiplier = 1;
	let flockDangerTarget = $state<{ x: number; y: number; progress: number; worldWidth: number }>();
	let flockEventPhase = '';
	let flockGateBase: ActiveGate | undefined;
	let impactEnvelope = $state(0);
	const flightPlaybackSpeed = $derived(presentationSpeed(playbackSpeed, wallet.turboDisabled));
	const controlsLocked = $derived(
		replayMode || status !== 'ready' || wallet.busy || !wallet.ready || wallet.active,
	);
	const landed = $derived(Boolean(activeEnding) && landingProgress === 1);
	const stakeAmount = $derived(stakeBetUnits(betInput));
	const betInputIsValid = $derived(
		wallet.live ? isValidStakeBet(stakeAmount, wallet) : isBetInputValid(betInput),
	);
	const displayedBet = $derived(displayedBetAmount());
	const displayedBetInput = $derived(
		displayedBet === selectedBet ? betInput : formatBetInput(displayedBet),
	);
	function displayedBetAmount() {
		return currentRound && status !== 'ready' && status !== 'complete'
			? currentRound.bet
			: selectedBet;
	}
	const activeCreature = $derived(
		getCreature(activeBirds.find((b) => b.id === focusBirdId)?.species ?? focusBirdId),
	);
	const selectedPathNote = $derived(getRiskNote(selectedRisk));
	const currentStage = $derived(getFlightStage(currentStageId));
	const resultWinTier = $derived(
		getWinTier(
			currentRound ? currentRound.finalWin / (currentRound.entryCost ?? currentRound.bet) : 0,
		),
	);
	// Route atmosphere is cosmetic; it never changes the stored result or payout.
	const activeHunter = $derived(currentRound ? (currentRound.hunter ?? 'forest') : selectedHunter);
	const activeWeather = $derived(currentRound?.weather ?? selectedWeather);
	const sceneWeather = $derived(championActive ? 'storm' : activeWeather);
	const activeTimeOfDay = $derived(
		currentRound?.timeOfDay ?? (selectedRisk === 'safe' ? 'day' : selectedTimeOfDay),
	);
	const activeTimeConfig = $derived(getTimeOfDay(activeTimeOfDay));
	// Retain round telemetry without displaying it in the permanent HUD.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const distanceMetres = $derived(Math.floor(distanceTravelled / 12));

	function updateBetInput(input: HTMLInputElement) {
		if (wallet.live) {
			betInput = input.value;
			const units = stakeBetUnits(betInput);
			if (isValidStakeBet(units, wallet)) selectedBet = units / 1e6;
			return;
		}
		const sanitized = sanitizeBetInput(input.value, betInput);
		input.value = sanitized;
		betInput = sanitized;

		const numericValue = Number(sanitized);
		if (
			Number.isFinite(numericValue) &&
			numericValue >= MIN_PROTOTYPE_BET &&
			numericValue <= MAX_PROTOTYPE_BET
		) {
			selectedBet = roundBet(numericValue);
		}
	}

	function normalizeBetInput() {
		if (wallet.live) {
			betInput = formatBetInput(selectedBet);
			return;
		}
		if (!betInputIsValid) void flightAudio.play('unavailable', 0.3, 'ui');
		const numericValue = Number(betInput);
		selectedBet = Number.isFinite(numericValue) ? clampBet(numericValue) : selectedBet;
		betInput = selectedBet.toFixed(2);
	}

	const minimumBet = $derived(
		wallet.live
			? (wallet.levels[0] ?? Math.ceil(wallet.minBet / wallet.stepBet) * wallet.stepBet) / 1e6
			: MIN_PROTOTYPE_BET,
	);
	const maximumBet = $derived(
		wallet.live
			? (wallet.levels.at(-1) ?? Math.floor(wallet.maxBet / wallet.stepBet) * wallet.stepBet) / 1e6
			: MAX_PROTOTYPE_BET,
	);
	const betValidationMessage = $derived(
		`${t('betRange')}: ${formatLocalAmount(minimumBet)}–${formatLocalAmount(maximumBet)}. ` +
			(wallet.live && wallet.levels.length
				? t('betLevelsOnly')
				: wallet.live
					? `${t('betStep')}: ${formatLocalAmount(wallet.stepBet / 1e6)}.`
					: t('betDecimalsOnly')),
	);
	const tubeOffer = $derived(
		currentRound && !wallet.live
			? tubeFlightOffer(currentRound, minimumBet, maximumBet, wallet.live, isReplay || replayMode)
			: undefined,
	);
	function moveBet(direction: -1 | 1) {
		if (controlsLocked) return;
		if (wallet.live) {
			const current = Math.round(selectedBet * 1e6);
			const next = wallet.levels.length
				? wallet.levels[wallet.levels.indexOf(current) + direction]
				: current + direction * wallet.stepBet;
			if (isValidStakeBet(next, wallet)) {
				selectedBet = next / 1e6;
				betInput = formatBetInput(selectedBet);
			}
			return;
		}
		selectedBet = clampBet(selectedBet + direction * PROTOTYPE_BET_STEP);
		betInput = formatBetInput(selectedBet);
	}

	async function delay(milliseconds: number, followFlightSpeed = true) {
		await timeline.animate(milliseconds, presentationToken, undefined, followFlightSpeed);
	}
	function animatePresentationValues(
		duration: number,
		update: (progress: number) => void,
		token: number,
		followFlightSpeed = true,
	) {
		return timeline.animate(duration, token, (p) => update(easeOut(p)), followFlightSpeed);
	}
	async function animateCurrentMultiplier(target: number, duration: number, token: number) {
		const startingMultiplier = currentMultiplier;
		multiplierPulse = true;
		await animatePresentationValues(
			duration,
			(progress) => {
				currentMultiplier = startingMultiplier + (target - startingMultiplier) * progress;
			},
			token,
		);
		if (token !== presentationToken) return;
		currentMultiplier = target;
		multiplierPulse = false;
	}

	async function showWarning(
		text: string,
		tone: WarningPresentation['tone'],
		token: number,
		duration = 420,
	) {
		eventWarning = { id: ++warningSequence, text, tone };
		await delay(duration);
		if (token !== presentationToken) return false;
		eventWarning = undefined;
		return true;
	}

	function showCombo(count: number) {
		const id = ++comboSequence;
		const token = presentationToken;
		comboFeedback = { id, count };
		void timeline.animate(650, token).then((ok) => {
			if (ok && token === presentationToken && comboFeedback?.id === id) comboFeedback = undefined;
		});
		emitParticles(Math.min(24, 7 + count * 3));
	}
	function cancelPresentation() {
		flightAudio.stopEffects();
		presentationToken += 1;
		birdBurst = undefined;
		birdBurstProgress = 0;
		const resolveGate = gateResolver;
		gateResolver = undefined;
		resolveGate?.();
		timeline.cancel();
		impactEnvelope = 0;
		hunterShot = undefined;
		activeGate = undefined;
		particles = [];
		championAnnouncement = false;
		stageAnnouncement = undefined;
		eventWarning = undefined;
		comboFeedback = undefined;
		activePickup = undefined;
		activeCurrent = undefined;
		activeEncounter = undefined;
		flockDangerTarget = undefined;
		activeEnding = undefined;
		landingProgress = 0;
		multiplierPulse = false;
	}

	function enterStage(stageId: FlightStageId, forceAnnouncement = false) {
		const changed = stageId !== currentStageId;
		currentStageId = stageId;
		if (!changed && !forceAnnouncement) return;

		const stage = getFlightStage(stageId);
		stageAnnouncement = {
			id: ++stageAnnouncementSequence,
			name: stage.name,
			order: stage.order,
		};
		const id = stageAnnouncement.id;
		const token = presentationToken;
		void timeline.animate(800, token).then((ok) => {
			if (ok && token === presentationToken && stageAnnouncement?.id === id)
				stageAnnouncement = undefined;
		});
		if (changed) emitParticles(6 + Math.round(stage.intensity * 12));
	}

	function updateFlightProgress(round: FlightRound, eventIndex: number) {
		const nextStage = championActive
			? 'STORM_HIGHLANDS'
			: stageForEventIndex(round.stagePlan, eventIndex);
		enterStage(nextStage, eventIndex === 0);
		if (!round.flock)
			flightProgress = Math.min(100, ((eventIndex + 1) / round.events.length) * 100);
	}

	function triggerFlap() {
		activeBirds = activeBirds.map((bird) =>
			bird.alive && !bird.exiting
				? {
						...bird,
						body: {
							...bird.body,
							velocity: { ...bird.body.velocity, y: bird.body.velocity.y - 20 },
						},
					}
				: bird,
		);
	}

	function emitParticles(count: number, impact = false, origin = player.position) {
		const additions = Array.from(
			{ length: count },
			(): FlightParticle => ({
				id: particleSequence++,
				x: origin.x + (impact ? player.radius : -player.radius),
				y: origin.y + (Math.random() - 0.5) * player.radius * 1.5,
				velocityX: impact ? (Math.random() - 0.5) * 220 : -60 - Math.random() * 100,
				velocityY: (Math.random() - 0.5) * (impact ? 230 : 95),
				life: 0.35 + Math.random() * 0.45,
				size: 2 + Math.random() * (impact ? 6 : 4),
			}),
		);
		particles = [...particles, ...additions].slice(-70);
	}

	function resetPresentation() {
		hunterShot = undefined;
		winCelebrationOpen = false;
		cancelPresentation();
		activeBirds = createFlock(bounds, undefined, selectedLineup);
		focusBirdId = 'archaeopteryx';
		championActive = false;
		championAnnouncement = false;
		flockAnnouncement = '';
		status = 'ready';
		currentRound = undefined;
		currentStageId = 'MOUNTAIN_VALLEY';
		flightProgress = 0;
		currentMultiplier = 1;
		finalMultiplier = 0;
		finalWin = 0;
		gatesPassed = 0;
		distanceTravelled = 0;
		activeGate = undefined;
		activePickup = undefined;
		activeCurrent = undefined;
		activeEncounter = undefined;
		flockDangerTarget = undefined;
		activeEnding = undefined;
		comboCount = 0;
		impactActive = false;
		eventLabel = 'READY';
		eventProgress = 0;
		eventCallout = '';
		particles = [];
		parallaxOffset = 0;
		flightTargetY = bounds.floorY * 0.5;
	}

	function createPresentedGate(event: Extract<FlightEvent, { type: 'gate' }>): ActiveGate {
		const routeWidth =
			currentRound?.risk === 'safe' ? 0.44 : currentRound?.risk === 'danger' ? 0.29 : 0.35;
		const gapHeight = clamp(bounds.height * routeWidth, 120, 245);
		const margin = gapHeight / 2 + 36;
		const gapCenterY = clamp(event.gapRatio * bounds.floorY, margin, bounds.floorY - margin);
		const width = clamp(bounds.width * 0.19, 95, 210);
		const visualWidth = getTerrainVisualWidth(
			event.hazard === 'forestPass' ? 'tree' : 'rock',
			gapCenterY - gapHeight / 2,
			bounds.height - gapCenterY - gapHeight / 2,
		);
		return {
			...event,
			// Keep the entire wider silhouette offscreen until it scrolls into view.
			x: bounds.width + 45 + Math.max(0, visualWidth - width) / 2,
			width,
			gapCenterY,
			gapHeight,
		};
	}

	async function presentGate(event: Extract<FlightEvent, { type: 'gate' }>) {
		activeGate = createPresentedGate(event);
		eventLabel = HAZARD_LABELS[event.hazard];
		eventCallout = `${HAZARD_LABELS[event.hazard]} · GATE ${event.gate}`;
		status = 'flying';
		triggerFlap();

		if (event.result === 'pass') {
			flightTargetY = activeGate.gapCenterY;
		} else {
			const gapTop = activeGate.gapCenterY - activeGate.gapHeight / 2;
			const gapBottom = activeGate.gapCenterY + activeGate.gapHeight / 2;
			flightTargetY =
				event.crashSide === 'upper'
					? Math.max(player.radius, gapTop - player.radius * 1.6)
					: Math.min(bounds.floorY - player.radius, gapBottom + player.radius * 1.6);
		}

		return new Promise<void>((resolve) => {
			gateResolver = resolve;
		});
	}

	async function presentPickup(event: Extract<FlightEvent, { type: 'pickup' }>, token: number) {
		const fromMultiplier = currentMultiplier;
		activePickup = {
			pickupType: event.pickupType,
			fromMultiplier,
			toMultiplier: event.multiplier,
		};
		eventLabel = PICKUP_LABELS[event.pickupType];
		eventCallout = PICKUP_LABELS[event.pickupType];
		flightTargetY = bounds.floorY * 0.43;
		triggerFlap();
		await delay(300);
		if (token !== presentationToken) return;
		void flightAudio.play(
			event.pickupType === 'feather'
				? 'feather-pickup'
				: event.pickupType === 'goldenFeather'
					? 'golden-feather-pickup'
					: 'crystal-pickup',
			0.4,
			'pickup',
		);
		await animateCurrentMultiplier(event.multiplier, 340, token);
		if (token !== presentationToken) return;
		emitParticles(event.pickupType === 'skyCrystal' ? 28 : 18);
		activePickup = undefined;
		await delay(150);
	}

	async function presentCurrent(event: Extract<FlightEvent, { type: 'current' }>, token: number) {
		void flightAudio.play('air-current', 0.3);
		const currentLabel = CURRENT_LABELS[event.currentType];
		if (event.currentType === 'crosswind' || event.currentType === 'valleyCurrent') {
			const warningShown = await showWarning(
				currentLabel,
				event.currentType === 'valleyCurrent' ? 'reward' : 'current',
				token,
				360,
			);
			if (!warningShown) return;
		}
		eventLabel = currentLabel;
		eventCallout = currentLabel;
		activeCurrent = {
			currentType: event.currentType,
			phase: 'approach',
			multiplier: event.multiplier,
		};
		flightTargetY = bounds.floorY * 0.46;
		triggerFlap();
		await delay(300);
		if (token !== presentationToken) return;
		activeCurrent = {
			currentType: event.currentType,
			phase: 'enter',
			multiplier: event.multiplier,
		};
		impactActive = event.currentType === 'crosswind';
		await animateCurrentMultiplier(event.multiplier, 360, token);
		if (token !== presentationToken) return;
		emitParticles(event.currentType === 'crosswind' ? 30 : 20);
		activeCurrent = {
			currentType: event.currentType,
			phase: 'release',
			multiplier: event.multiplier,
		};
		await delay(220);
		if (token !== presentationToken) return;
		activeCurrent = undefined;
		impactActive = false;
	}

	async function presentEncounter(
		event: Extract<FlightEvent, { type: 'encounter' }>,
		token: number,
	) {
		const encounterLabel = ENCOUNTER_LABELS[event.encounterType];
		void flightAudio.play('encounter-warning', 0.3);
		const warningShown = await showWarning(encounterLabel, 'danger', token, 430);
		if (!warningShown) return;
		eventLabel = encounterLabel;
		void flightAudio.play('ridge-dragon-call', 0.3, 'predator');
		eventCallout = 'DANGER AHEAD';
		activeEncounter = { encounterType: event.encounterType, result: event.result, phase: 'enter' };
		flightTargetY = bounds.floorY * 0.38;
		triggerFlap();
		await delay(330);
		if (token !== presentationToken) return;
		activeEncounter = { encounterType: event.encounterType, result: event.result, phase: 'engage' };
		impactActive = true;
		await delay(380);
		if (token !== presentationToken) return;
		activeEncounter = {
			encounterType: event.encounterType,
			result: event.result,
			phase: 'resolve',
		};
		await animateCurrentMultiplier(event.multiplier, 300, token);
		if (token !== presentationToken) return;
		if (event.result === 'pass') {
			eventCallout = 'PREDATOR AVOIDED';
			void flightAudio.play('predator-pass', 0.3, 'predator');
			emitParticles(30, true);
		} else {
			eventCallout = 'PREDATOR STRIKE';
			void flightAudio.play('crash', 0.4);
			status = 'collided';
			activeBirds = eliminateBird(activeBirds, focusBirdId, 'predator');
			emitParticles(38, true);
		}
		await delay(event.result === 'crash' ? 420 : 300);
		if (token !== presentationToken) return;
		activeEncounter = undefined;
		flockDangerTarget = undefined;
		impactActive = event.result === 'crash';
	}

	async function presentEnding(event: Extract<FlightEvent, { type: 'ending' }>, token: number) {
		activeEnding = event.ending;
		status = 'ending';
		landingProgress = 0;
		eventCallout = ENDING_LABELS[event.ending];
		if (!currentRound?.flock) setLeadBody({ ...player, velocity: { x: 0, y: 0 } });
		triggerFlap();
		await animateCurrentMultiplier(event.multiplier, 320, token);
		if (token !== presentationToken) return;
		const start = { x: player.position.x / bounds.width, y: player.position.y / bounds.height };
		await animatePresentationValues(
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1500,
			(progress) => {
				landingProgress = progress;
				if (currentRound?.flock) return;
				const eased = progress;
				const target = landingPosition();
				setLeadBody({
					...player,
					position: {
						x: start.x * bounds.width + (target.x - start.x * bounds.width) * eased,
						y:
							start.y * bounds.height +
							(target.y - start.y * bounds.height) * eased -
							Math.sin(progress * Math.PI) * bounds.height * 0.09,
					},
					velocity: { x: 0, y: 0 },
				});
			},
			token,
		);
		if (token !== presentationToken) return;
		const endingIntensity = {
			safeLanding: 12,
			meadowLanding: 20,
			ridgeLanding: 28,
			hiddenValley: 34,
			summitLanding: 42,
		}[event.ending];
		flightAudio.stop('wings');
		void flightAudio.play('landing', 0.4);
		emitParticles(endingIntensity);
		await delay(300 + endingIntensity * 10);
	}

	function landingPosition() {
		// Same normalized anchor as the image's object-position, including narrow cover crops.
		const footOffset = clamp(window.innerWidth * 0.046, 38, 58) * activeCreature.sizeScale * 0.32;
		return { x: bounds.width * LANDING_ANCHOR.x, y: bounds.height * LANDING_ANCHOR.y - footOffset };
	}

	async function presentFinalResult(round: FlightRound, token: number) {
		if (token !== presentationToken) return;
		if (wallet.live && !isReplay && !settledRounds.has(round.id)) {
			try {
				await settleRoundOnce(
					round.id,
					() => stakeSession.settle(),
					pendingSettlements,
					settledRounds,
				);
			} catch {
				return;
			}
			if (token !== presentationToken) return;
			if (!settledRounds.has(round.id)) {
				settledRounds.add(round.id);
			}
		}
		flightAudio.stop('wings');
		flightAudio.stop('result');
		if (!isReplay && !flightHistory.some((item) => item.id === round.id)) {
			flightHistory = [round, ...flightHistory].slice(0, 20);
		}
		const tier = getWinTier(round.finalWin / (round.entryCost ?? round.bet));
		eventLabel = tier.label;
		eventCallout = round.flock?.bonusTriggered
			? round.flock.bonus?.ending === 'crash'
				? 'BONUS FAILED · BASE WIN RETAINED'
				: 'CHAMPION BONUS WON'
			: round.ending === 'crash'
				? 'CRASH'
				: tier.label;

		if (round.flock) {
			activeGate = undefined;
			activeCurrent = undefined;
			activePickup = undefined;
			activeEncounter = undefined;
			flockDangerTarget = undefined;
			hunterShot = undefined;
			flightProgress = 100;
			currentMultiplier = round.finalMultiplier;
			finalMultiplier = round.finalMultiplier;
			finalWin = round.finalWin;
			const bonus = round.flock.bonus;
			if (bonus && bonus.ending !== 'crash')
				eventCallout = `BONUS WON · +${formatLocalAmount(round.bet * bonus.multiplier)}`;
			void flightAudio.play(
				bonus?.ending === 'crash'
					? 'result-return'
					: resultSound(round.finalWin, round.entryCost ?? round.bet),
				0.35,
				'result',
			);
			await delay(450);
			if (token !== presentationToken) return;
			status = 'complete';
			return;
		}

		if (round.finalWin <= 0) {
			void flightAudio.play(
				resultSound(round.finalWin, round.entryCost ?? round.bet),
				0.35,
				'result',
			);
			status = 'complete';
			finalMultiplier = round.finalMultiplier;
			finalWin = round.finalWin;
			currentMultiplier = round.finalMultiplier;
			return;
		}

		finalMultiplier = 0;
		finalWin = 0;
		winCelebrationOpen = round.finalWin > 0;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const amountDecimals = Math.max(
			2,
			(round.finalWin.toFixed(6).match(/\.(\d*?[1-9])0*$/)?.[1] ?? '').length,
		);
		if (!reducedMotion) void flightAudio.play('win-count-loop', 0.35, 'win-counter', true);
		await animatePresentationValues(
			reducedMotion ? 1 : Math.max(1800, tier.duration * 3),
			(progress) => {
				finalMultiplier = round.finalMultiplier * progress;
				finalWin = Number((round.finalWin * progress).toFixed(amountDecimals));
			},
			token,
			false,
		);
		if (token !== presentationToken) return;
		flightAudio.stop('win-counter');
		void flightAudio.play('win-count-finish', 0.35, 'result');
		finalMultiplier = round.finalMultiplier;
		finalWin = round.finalWin;
		currentMultiplier = round.finalMultiplier;
		if (winCelebrationOpen) await delay(reducedMotion ? 1000 : 1400, false);
		if (token !== presentationToken) return;
		winCelebrationOpen = false;
		status = 'complete';
	}

	function beginFlockEvent(event: FlightEvent, index: number) {
		eventProgress = index + 1;
		flockEventStartMultiplier = currentMultiplier;
		flockEventPhase = '';
		flockDangerTarget = undefined;
		activeGate = undefined;
		activePickup = undefined;
		activeCurrent = undefined;
		activeEncounter = undefined;
		flockDangerTarget = undefined;
		hunterShot = undefined;
		status = 'flying';
		const kind = presentationKind(event);
		hunterShotIndex = -1;
		hunterAttack =
			event.type === 'elimination' && event.reason === 'hunter'
				? planHunterAttack(
						activeBirds.find((b) => b.id === event.bird)?.species ?? event.bird,
						currentRound?.risk ?? selectedRisk,
					)
				: undefined;
		flightTargetY = bounds.floorY * (kind === 'wind' ? 0.44 : kind === 'predator' ? 0.56 : 0.5);
		eventLabel = kind.toUpperCase();
		eventCallout =
			event.type === 'gate'
				? HAZARD_LABELS[event.hazard]
				: event.type === 'elimination'
					? `${getCreature(activeBirds.find((b) => b.id === event.bird)?.species ?? event.bird).name.toUpperCase()} · ${event.reason.toUpperCase()} DANGER`
					: event.type === 'pickup'
						? PICKUP_LABELS[event.pickupType]
						: event.type === 'current'
							? CURRENT_LABELS[event.currentType]
							: event.type === 'encounter'
								? 'PREDATOR APPROACHING'
								: event.type === 'championFlight'
									? '4/4 SURVIVED'
									: event.type === 'ending'
										? ENDING_LABELS[event.ending]
										: '';
		if (event.type === 'launch') {
			void flightAudio.play('wind', 0.4, 'flock-launch');
			emitParticles(12);
		}
		if (kind === 'terrain') {
			flockGateBase = createPresentedGate(
				event.type === 'gate'
					? event
					: { type: 'gate', gate: index + 1, hazard: 'cliffGap', gapRatio: 0.5, result: 'pass' },
			);
			flockGateBase.gapCenterY =
				(bounds.floorY + Math.min(165, Math.max(145, bounds.height * 0.38))) / 2;
			flockGateBase.gapHeight = bounds.floorY - Math.min(125, bounds.height * 0.34);
			activeGate = flockGateBase;
		}
		if (event.type === 'pickup') {
			activePickup = {
				pickupType: event.pickupType,
				fromMultiplier: currentMultiplier,
				toMultiplier: event.multiplier,
			};
			void flightAudio.play('feather-pickup', 0.3, 'pickup');
		}
		if (kind === 'wind') void flightAudio.play('air-current', 0.3);
		if (kind === 'predator') void flightAudio.play('encounter-warning', 0.3);
		if (event.type === 'championFlight') {
			landingProgress = 0;
			championAnnouncement = true;
			void flightAudio.play('bonus-start', 0.4);
		}
		if (event.type === 'ending') {
			activeEnding = event.ending;
			status = 'ending';
			landingProgress = 0;
		}
	}
	function frameFlockEvent(event: FlightEvent, p: number) {
		const kind = presentationKind(event);
		const phase = p < 0.3 ? 'enter' : p < 0.72 ? 'engage' : 'resolve';
		if (kind === 'terrain' && flockGateBase)
			activeGate = {
				...flockGateBase,
				x: bounds.width + flockGateBase.width - p * (bounds.width + flockGateBase.width * 2),
			};
		if (kind === 'hunter' && event.type === 'elimination' && hunterAttack) {
			const targetBird = activeBirds.find((b) => b.id === event.bird && b.alive);
			if (targetBird) {
				const frame = hunterAttackFrame(hunterAttack, p);
				hunterShot = {
					target: targetBird.body.position,
					hit: true,
					progress: frame.bulletProgress,
				};
				activeBirds = applyHunterHealth(activeBirds, event.bird, frame.health, frame.flash);
				if (frame.index >= 0 && frame.index !== hunterShotIndex) {
					hunterShotIndex = frame.index;
					flightAudio.shot(currentRound?.risk ?? selectedRisk, flightPlaybackSpeed);
				}
			}
		}
		if (kind === 'predator' && (event.type === 'elimination' || championActive)) {
			const id = event.type === 'elimination' ? event.bird : 'archaeopteryx';
			const bird = activeBirds.find((b) => b.id === id);
			if (bird)
				flockDangerTarget = {
					...bird.body.position,
					progress: Math.min(1, p / 0.52),
					worldWidth: bounds.width,
				};
		}
		if (phase !== flockEventPhase) {
			flockEventPhase = phase;
			if (kind === 'wind')
				activeCurrent = {
					currentType: event.type === 'current' ? event.currentType : 'crosswind',
					phase: phase === 'enter' ? 'approach' : phase === 'engage' ? 'enter' : 'release',
					multiplier: 'multiplier' in event ? event.multiplier : currentMultiplier,
				};
			if (kind === 'predator')
				activeEncounter = {
					encounterType: event.type === 'encounter' ? event.encounterType : 'ridgeDragon',
					result: event.type === 'encounter' ? event.result : 'crash',
					phase,
				};
		}
		if ('multiplier' in event && event.type !== 'finalWin')
			currentMultiplier =
				flockEventStartMultiplier + (event.multiplier - flockEventStartMultiplier) * easeOut(p);
		if (event.type === 'ending') landingProgress = p;
		if (event.type === 'championFlight' && p > 0.8) championAnnouncement = false;
	}
	function commitFlockEvent(event: FlightEvent) {
		if (event.type === 'elimination') {
			const bird = activeBirds.find((b) => b.id === event.bird);
			if (bird) emitParticles(18, true, bird.body.position);
			activeBirds = eliminateBird(activeBirds, event.bird, event.reason);
			hunterShot = undefined;
			impactEnvelope = 0.18;
			flockAnnouncement = `${getCreature(bird?.species ?? event.bird).name} eliminated. ${activeBirds.filter((b) => b.alive).length} of four birds remain.`;
			void flightAudio.play(
				event.reason === 'wind' ? 'air-current' : 'crash',
				0.3,
				'flock-elimination',
			);
		} else if (event.type === 'championFlight') {
			activeEnding = undefined;
			activeBirds = startChampion(activeBirds);
			focusBirdId = 'archaeopteryx';
			championActive = true;
			enterStage('STORM_HIGHLANDS');
			flockAnnouncement = '4/4 survived. Champion Flight started.';
		} else if (event.type === 'encounter' && event.result === 'crash' && championActive) {
			activeBirds = eliminateBird(activeBirds, 'archaeopteryx', 'predator');
			impactEnvelope = 0.18;
			flockAnnouncement = 'Bonus failed. Base win retained.';
		} else if (event.type === 'ending') {
			void flightAudio.play('landing', 0.3);
			emitParticles(12);
		}
	}

	async function presentRound(round: FlightRound, token: number) {
		if (round.flock) {
			await runFlockTimeline(round, {
				valid: () => token === presentationToken,
				animate: (duration, update) => timeline.animate(duration, token, update),
				travel: () => {
					activeGate = undefined;
					activeCurrent = undefined;
					activeEncounter = undefined;
					activePickup = undefined;
					flockDangerTarget = undefined;
					hunterShot = undefined;
					eventLabel = 'FLIGHT';
					eventCallout = '';
					status = 'flying';
				},
				begin: beginFlockEvent,
				frame: frameFlockEvent,
				commit: commitFlockEvent,
				progress: (value) => {
					flightProgress = value;
				},
				settle: () => presentFinalResult(round, token),
			});
			return;
		}

		for (const [index, event] of round.events.entries()) {
			if (token !== presentationToken) return;
			eventProgress = index + 1;
			updateFlightProgress(round, index);

			switch (event.type) {
				case 'launch':
					void flightAudio.play('wind', 0.5, 'flock-launch');
					eventLabel = 'LAUNCH';
					eventCallout = `${round.launchStyle.toUpperCase()} LAUNCH`;
					status = 'flying';
					flightTargetY =
						event.path === 'safe'
							? bounds.floorY * 0.42
							: event.path === 'danger'
								? bounds.floorY * 0.34
								: bounds.floorY * 0.5;
					setLeadBody({
						...player,
						velocity: {
							x: round.launchStyle === 'glide' ? 0 : round.launchStyle === 'boost' ? 20 : -10,
							y: round.launchStyle === 'boost' ? -155 : round.launchStyle === 'dive' ? 120 : -85,
						},
					});
					triggerFlap();
					emitParticles(12);
					await delay(350);
					break;
				case 'gate':
					await presentGate(event);
					if (token !== presentationToken) return;
					if (event.result === 'pass') {
						void flightAudio.play('result-win', 0.2, 'gate-pass');
						comboCount += 1;
						showCombo(comboCount);
					} else {
						comboCount = 0;
						eventCallout = 'CRASH';
						flightAudio.stop('wings');
						activeBirds = eliminateBird(
							activeBirds,
							focusBirdId,
							event.hazard === 'windPass' ? 'wind' : 'terrain',
						);
						birdBurst = 'playing';
						birdBurstProgress = 0;
						void flightAudio.play('crash', 0.4);
						const completed = await timeline.animate(650, token, (p) => (birdBurstProgress = p));
						if (!completed || token !== presentationToken) return;
						birdBurst = 'finished';
					}
					if (event.result === 'crash') await delay(420);
					break;
				case 'pickup':
					await presentPickup(event, token);
					break;
				case 'current':
					await presentCurrent(event, token);
					break;
				case 'encounter':
					await presentEncounter(event, token);

					break;
				case 'ending':
					eventLabel = ENDING_LABELS[event.ending];
					eventCallout = ENDING_LABELS[event.ending];
					await presentEnding(event, token);
					break;
				case 'finalWin':
					flockAnnouncement = round.flock
						? `${round.flock.survivors} of four birds survived${round.flock.bonusTriggered ? '. Champion Flight complete' : ''}.`
						: '';
					await presentFinalResult(round, token);
					break;
			}
		}
	}

	function startFlight(bonusId?: BonusFlightId) {
		if (controlsLocked || !betInputIsValid) {
			void flightAudio.play('unavailable', 0.25, 'ui');
			return;
		}
		flightError = '';
		if (wallet.live) {
			void startStakeFlight(bonusId);
			return;
		}
		roundSequence += 1;
		const options = {
			creature: legacyCreatureId,
			launchStyle: selectedLaunchStyle,
		};
		try {
			const round: FlightRound = bonusId
				? createBonusRound(bonusId, selectedBet, roundSequence, drawBonusTicket(), options)
				: {
						...generateMockRound(selectedBet, selectedRisk, roundSequence, options),
						weather: selectedWeather,
						timeOfDay: selectedRisk === 'safe' ? 'day' : selectedTimeOfDay,
					};
			bonusOpen = false;
			beginFlight(round);
		} catch {
			bonusOpen = false;
			flightError = 'Could not start this demo flight. Please try again.';
			void flightAudio.play('unavailable', 0.3, 'ui');
		}
	}

	function startTubeFlight(previous: FlightRound, amount: number) {
		if (controlsLocked || wallet.live || wallet.busy || wallet.active || !betInputIsValid) return;
		flightError = '';
		roundSequence += 1;
		try {
			const round = createTubeFlight(previous, amount, roundSequence);
			bonusOpen = false;
			beginFlight(round);
		} catch {
			bonusOpen = false;
			flightError = 'Could not start this demo flight. Please try again.';
			void flightAudio.play('unavailable', 0.3, 'ui');
		}
	}

	function beginFlight(round: FlightRound, replay = false) {
		if (status !== 'ready') return;
		round = attachHunter(attachLineup(round, selectedLineup, replay), selectedHunter, replay);
		hunterShot = undefined;
		settingsMenuOpen = false;
		flightAudio.stopEffects();
		birdBurst = undefined;
		birdBurstProgress = 0;
		if (round.bonusFlight) void flightAudio.play('bonus-start', 0.3);
		isReplay = replay;
		if (round.ending !== 'crash' && !round.flock) {
			void decodeScene(
				getFinishBackground(
					round.ending,
					round.weather ?? selectedWeather,
					round.timeOfDay ?? selectedTimeOfDay,
				),
			).catch(() => undefined);
		}
		const token = ++presentationToken;
		championActive = false;
		championAnnouncement = false;
		currentRound = round;
		activeBirds = createFlock(bounds, round);
		focusBirdId = round.flock ? 'woodpecker' : round.creature;
		flockAnnouncement = round.flock
			? 'Four birds launched.'
			: round.route === 'tube-flight'
				? 'Fluppy Flight started. Archaeopteryx launched.'
				: 'Legacy single-bird round.';
		currentStageId = round.stagePlan[0]?.stage ?? 'MOUNTAIN_VALLEY';
		flightProgress = 0;
		stageAnnouncement = undefined;
		currentMultiplier = 1;
		finalMultiplier = 0;
		finalWin = 0;
		gatesPassed = 0;
		distanceTravelled = 0;
		activeGate = undefined;
		activePickup = undefined;
		activeCurrent = undefined;
		activeEncounter = undefined;
		flockDangerTarget = undefined;
		activeEnding = undefined;
		eventWarning = undefined;
		comboFeedback = undefined;
		comboCount = 0;
		multiplierPulse = false;
		impactActive = false;
		eventLabel = 'LAUNCHING';
		eventProgress = 0;
		eventCallout = '';
		particles = [];
		status = 'flying';
		// Short windows may have scrolled down to the controls.
		worldElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		void presentRound(round, token);
	}

	function flyAgain() {
		if (replayMode) {
			if (sharedReplay && status === 'complete') replayFlight(sharedReplay);
			return;
		}
		if (status !== 'complete' || !currentRound || wallet.busy || !wallet.ready || wallet.active)
			return;
		const previous = currentRound;
		resetPresentation();
		if (previous.route === 'tube-flight') return;
		selectedBet = previous.bet;
		betInput = formatBetInput(previous.bet);
		selectedLaunchStyle = previous.launchStyle;
		if (!previous.bonusFlight) {
			selectedRisk = previous.risk;

			selectedTimeOfDay = previous.timeOfDay ?? selectedTimeOfDay;
		}
		startFlight(previous.bonusFlight);
	}

	function flyFromMenu() {
		if (wallet.busy || !wallet.ready || wallet.active || !betInputIsValid || replayMode) return;
		if (menuOffer.bonusFlight) {
			flyAgain();
			return;
		}
		if (status === 'complete') resetPresentation();
		startFlight();
	}

	function playTubeFlight() {
		if (status !== 'complete' || !currentRound || wallet.busy || !wallet.ready || wallet.active)
			return;
		const offer = tubeFlightOffer(
			currentRound,
			minimumBet,
			maximumBet,
			wallet.live,
			isReplay || replayMode,
		);
		if (!offer || offer.reason) return;
		const previous = currentRound;
		resetPresentation();
		selectedRisk = previous.risk;
		selectedLaunchStyle = previous.launchStyle;

		selectedTimeOfDay = previous.timeOfDay ?? selectedTimeOfDay;
		startTubeFlight(previous, offer.amount);
	}

	function replayFlight(round: FlightRound) {
		if (
			(status !== 'ready' && status !== 'complete') ||
			wallet.busy ||
			!wallet.ready ||
			wallet.active
		)
			return;
		historyOpen = false;
		resetPresentation();
		beginFlight(round, true);
	}

	function updateParticles(deltaSeconds: number) {
		particles = particles
			.map((particle) => ({
				...particle,
				x: particle.x + particle.velocityX * deltaSeconds,
				y: particle.y + particle.velocityY * deltaSeconds,
				velocityY: particle.velocityY + 100 * deltaSeconds,
				life: particle.life - deltaSeconds,
			}))
			.filter((particle) => particle.life > 0);
	}

	function finishActiveGate() {
		activeGate = undefined;
		const resolve = gateResolver;
		gateResolver = undefined;
		resolve?.();
	}

	function updateActiveGate(deltaSeconds: number) {
		if (!activeGate || status !== 'flying') return;
		activeGate = { ...activeGate, x: activeGate.x - WORLD_SPEED * deltaSeconds };

		if (activeGate.result === 'pass' && activeGate.x + activeGate.width < player.position.x) {
			gatesPassed += 1;
			finishActiveGate();
		} else if (
			activeGate.result === 'crash' &&
			activeGate.x + activeGate.width * 0.48 <= player.position.x + player.radius
		) {
			status = 'collided';
			impactActive = true;
			setLeadBody({ ...player, velocity: { x: 0, y: 0 } });
			emitParticles(28, true);
			finishActiveGate();
		}
	}

	function resizeWorld() {
		if (!worldElement) return;
		const previous = bounds;
		const width = worldElement.clientWidth;
		const height = worldElement.clientHeight;
		if (!width || !height) return;
		bounds = { width, height, floorY: height - clamp(height * 0.085, 34, 48) };
		const widthRatio = width / previous.width;
		const heightRatio = height / previous.height;
		activeBirds =
			status === 'ready'
				? createFlock(bounds, undefined, selectedLineup)
				: resizeFlock(activeBirds, previous, bounds);
		flightTargetY *= heightRatio;
		if (!currentRound?.flock && activeEnding && landingProgress === 1)
			setLeadBody({ ...player, position: landingPosition() });
		if (activeGate) {
			activeGate = {
				...activeGate,
				x: activeGate.x * widthRatio,
				width: clamp(width * 0.19, 95, 210),
				gapCenterY: activeGate.gapCenterY * heightRatio,
				gapHeight: activeGate.gapHeight * heightRatio,
			};
		}
	}

	onMount(() => {
		document.documentElement.lang = language;
		document.documentElement.dir = textDirection;
		let disposed = false;
		stakeSession = new StakeSession((state) => {
			if (disposed) return;
			if (state.error && !wallet.error) cancelPresentation();
			wallet = state;
		});
		void connectStake();
		try {
			soundMuted = localStorage.getItem('dragon-flight-muted') === 'true';
		} catch {
			/* Optional preference. */
		}
		flightAudio.setMuted(soundMuted);
		flightAudio.setHidden(document.hidden);
		const visibility = () => flightAudio.setHidden(document.hidden);
		const unlock = () => flightAudio.unlock();
		const flyWithSpace = (event: KeyboardEvent) => {
			if (
				event.code !== 'Space' ||
				event.repeat ||
				event.defaultPrevented ||
				event.isComposing ||
				event.ctrlKey ||
				event.altKey ||
				event.metaKey ||
				event.shiftKey ||
				(controlsLocked && status !== 'complete') ||
				replayMode ||
				wallet.busy ||
				!wallet.ready ||
				wallet.active ||
				!betInputIsValid ||
				wallet.spacebarDisabled ||
				customizeOpen ||
				helpOpen ||
				bonusOpen ||
				historyOpen ||
				settingsMenuOpen
			)
				return;
			const focused = document.activeElement;
			const interactive = (target: EventTarget | null) =>
				target instanceof Element &&
				(Boolean(
					target.closest(
						'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])',
					),
				) ||
					(target instanceof HTMLElement && target.isContentEditable));
			if (interactive(focused) || event.composedPath().some(interactive)) return;
			event.preventDefault();
			flyFromMenu();
		};
		const click = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : undefined;
			const button = target?.closest('button');
			if (
				!button ||
				button.disabled ||
				button.hasAttribute('data-audio-toggle') ||
				button.hasAttribute('data-audio-panel')
			)
				return;
			if (!button.closest('.prototype-shell, dialog')) return;
			void flightAudio.play(
				button.hasAttribute('aria-pressed') || button.hasAttribute('data-audio-select')
					? 'option-select'
					: 'button-click',
				0.18,
				'ui',
			);
		};
		const change = (event: Event) => {
			if (
				event.target instanceof HTMLSelectElement ||
				(event.target instanceof HTMLInputElement && event.target.type === 'radio')
			)
				void flightAudio.play('option-select', 0.22, 'ui');
		};
		document.addEventListener('pointerdown', unlock, true);
		document.addEventListener('keydown', unlock, true);
		document.addEventListener('keydown', flyWithSpace);
		document.addEventListener('click', click, true);
		document.addEventListener('change', change);
		document.addEventListener('visibilitychange', visibility);
		for (const creature of CREATURES) {
			if (!creature.flightAnimation) continue;
			void loadDecodedFlightFrames(creature.flightAnimation.frames)
				.then((frames) => {
					if (disposed) return;
					loadedCreatureFrames = { ...loadedCreatureFrames, [creature.id]: frames };
				})
				.catch(() => undefined);
		}
		const observer = new ResizeObserver(resizeWorld);
		if (worldElement) observer.observe(worldElement);
		resizeWorld();
		let animationFrame = 0;
		let lastTime = performance.now();

		const update = (now: number) => {
			const deltaSeconds = document.hidden
				? 0
				: Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
			lastTime = now;
			const moving = status === 'flying' || status === 'ending' || status === 'collided';
			const flightDelta = deltaSeconds * flightPlaybackSpeed;
			timeline.tick(deltaSeconds, flightPlaybackSpeed, presentationToken, document.hidden);
			impactEnvelope = Math.max(0, impactEnvelope - flightDelta);
			const environmentSpeed = WORLD_SPEED * currentStage.parallaxSpeed;
			const presentationSpeed = status === 'collided' ? environmentSpeed * 0.22 : environmentSpeed;
			parallaxOffset =
				(parallaxOffset +
					(moving
						? flightDelta * presentationSpeed * (impactEnvelope > 0 ? 0.65 : 1)
						: deltaSeconds * 30)) %
				1800;
			updateParticles(flightDelta);

			activeBirds = stepFlock(
				activeBirds,
				flightDelta,
				bounds,
				flightTargetY,
				moving,
				status === 'ending' ? landingProgress : 0,
				currentRound?.launchStyle,
			);
			if (status === 'flying') {
				if (!currentRound?.flock)
					updateActiveGate(flightDelta * (activeGate ? GATE_APPROACH_RATE : 1));
				distanceTravelled += WORLD_SPEED * flightDelta;
			}
			animationFrame = requestAnimationFrame(update);
		};

		animationFrame = requestAnimationFrame(update);
		return () => {
			document.removeEventListener('pointerdown', unlock, true);
			document.removeEventListener('keydown', unlock, true);
			document.removeEventListener('keydown', flyWithSpace);
			document.removeEventListener('click', click, true);
			document.removeEventListener('change', change);
			document.removeEventListener('visibilitychange', visibility);
			flightAudio.dispose();
			disposed = true;
			loadedCreatureFrames = {};
			cancelPresentation();
			observer.disconnect();
			cancelAnimationFrame(animationFrame);
		};
	});
</script>

<svelte:head>
	<title>Lucky Flight</title>
	{#each [...Object.values(PICKUP_ARTWORK), ...Object.values(ENCOUNTER_ARTWORK)] as src (src)}
		<link rel="preload" as="image" href={src} type="image/webp" />
	{/each}
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') settingsMenuOpen = false;
	}}
/>

<main class="prototype-shell" style={`--playback-speed:${flightPlaybackSpeed};`}>
	<section class="game-layout">
		<div
			bind:this={worldElement}
			class:has-impact={impactActive}
			class:has-ending={Boolean(activeEnding)}
			class:bird-burst={Boolean(birdBurst)}
			class={`world ${currentStage.className} weather-${sceneWeather}`}
			style={`--floor-scroll:${-(parallaxOffset % (43 / Math.sin(Math.PI / 12)))}px;--flight-offset:${parallaxOffset}px;`}
		>
			<Landscape
				huntScene={!currentRound || Boolean(currentRound.flock)}
				ending={activeEnding}
				stage={currentStageId}
				weather={sceneWeather}
				timeOfDay={activeTimeOfDay}
				{parallaxOffset}
				playbackSpeed={flightPlaybackSpeed}
			/>
			<Atmosphere
				onThunder={() => {
					void flightAudio.play('thunder', 0.18, 'thunder');
				}}
				finishScene={Boolean(activeEnding)}
				weather={sceneWeather}
				timeOfDay={activeTimeOfDay}
				stageIntensity={currentStage.intensity}
				{parallaxOffset}
				launchStyle={currentRound?.launchStyle ?? selectedLaunchStyle}
				active={status !== 'ready' && status !== 'complete'}
			/>
			<header class="prototype-header">
				<div class="header-balance">
					<span class="currency-medallion" aria-hidden="true">{betCurrencySymbol}</span>
					<div>
						<span>{wallet.live ? t('balance') : 'Demo mode'}</span><strong
							>{wallet.live ? formatLocalAmount(wallet.amount / 1e6) : '—'}</strong
						>
					</div>
				</div>
				<h1 class="flight-title">
					<span
						><svg viewBox="0 0 70 55" aria-hidden="true"
							><path
								d="M65 43C44 39 20 25 4 4c3 22 24 34 48 40M12 28c7 16 25 21 43 20M25 43c8 9 22 11 33 8"
							/></svg
						></span
					><span>Lucky<br />Flight</span><span
						><svg viewBox="0 0 70 55" aria-hidden="true"
							><path
								d="M65 43C44 39 20 25 4 4c3 22 24 34 48 40M12 28c7 16 25 21 43 20M25 43c8 9 22 11 33 8"
							/></svg
						></span
					>
				</h1>
				<div class="top-icons">
					<button
						type="button"
						aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
						aria-pressed={!soundMuted}
						onclick={toggleSound}
						><svg viewBox="0 0 24 24" aria-hidden="true"
							><path d="M11 5 6 9H3v6h3l5 4z" />{#if soundMuted}<path
									d="m16 9 5 6m0-6-5 6"
								/>{:else}<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />{/if}</svg
						></button
					>
					<button
						type="button"
						aria-label="Game settings"
						aria-expanded={settingsMenuOpen}
						aria-controls="flight-settings-menu"
						onclick={() => (settingsMenuOpen = !settingsMenuOpen)}
						><svg viewBox="0 0 24 24" aria-hidden="true"
							><path
								d="m9 3-.6 2.5-2 .9L4 5.7 2 9l1.9 1.8v2.4L2 15l2 3.3 2.4-.7 2 .9L9 21h6l.6-2.5 2-.9 2.4.7 2-3.3-1.9-1.8v-2.4L22 9l-2-3.3-2.4.7-2-.9L15 3z"
							/><circle cx="12" cy="12" r="3" /></svg
						></button
					>
					<button
						type="button"
						aria-label="Toggle fullscreen"
						disabled={wallet.fullscreenDisabled}
						onclick={toggleFullscreen}
						><svg viewBox="0 0 24 24" aria-hidden="true"
							><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg
						></button
					>
				</div>
				<div
					class="control-tools header-actions flight-extras"
					hidden={!settingsMenuOpen}
					id="flight-settings-menu"
					role="group"
					aria-label="Flight options"
				>
					<button
						type="button"
						class="header-button"
						data-audio-toggle
						aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
						aria-pressed={!soundMuted}
						onclick={toggleSound}>{soundMuted ? t('soundOff') : t('soundOn')}</button
					>
					<label
						class="playback-control"
						title="Animation speed only. Odds and payouts stay the same."
					>
						<span>{t('speed')}</span>
						<select
							aria-label="Flight playback speed"
							bind:value={playbackSpeed}
							disabled={controlsLocked || wallet.turboDisabled}
						>
							<option value={1}>1×</option>
							<option value={1.5}>1.5×</option>
							<option value={2}>2×</option>
						</select>
					</label>
					<button
						class="header-button"
						type="button"
						aria-haspopup="dialog"
						aria-controls="customize-flight"
						data-audio-panel
						aria-expanded={customizeOpen}
						disabled={controlsLocked}
						onclick={() => (customizeOpen = true)}>{t('customize')}</button
					>
					<button
						class="help-button"
						type="button"
						aria-label={t('guide')}
						data-audio-panel
						onclick={() => (helpOpen = true)}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><circle cx="12" cy="12" r="9" /><path
								d="M9.7 9.2a2.45 2.45 0 1 1 3.7 2.1c-.9.5-1.4 1-1.4 2"
							/><path d="M12 16.8h.01" /></svg
						>
					</button>

					<button
						disabled={wallet.busy ||
							!wallet.ready ||
							wallet.active ||
							(status !== 'ready' && status !== 'complete')}
						data-audio-panel
						onclick={() => (historyOpen = true)}
						>{t('history')} <span>{flightHistory.length}</span></button
					>
					<label class="language-control">
						<span>{t('language')}</span>
						<select
							aria-label={t('language')}
							value={language}
							onchange={(event) =>
								changeLanguage(event.currentTarget.value as (typeof SUPPORTED_LANGUAGES)[number])}
						>
							{#each SUPPORTED_LANGUAGES as code (code)}<option value={code}
									>{LANGUAGE_NAMES[code]}</option
								>{/each}
						</select>
					</label>
				</div>
			</header>
			{#if status !== 'complete'}
				<div class="flight-hud">
					<div class="flock-hud-group">
						<span class="round-status" class:danger={status === 'collided'}
							>{wallet.busy
								? t('pleaseWait')
								: !wallet.ready
									? t('disconnected')
									: status === 'ready'
										? t('ready')
										: status === 'collided'
											? ENDING_LABELS.crash
											: t('flightActive')}</span
						>
						{#if currentRound?.flock && status !== 'ready'}<FlockStatus
								birds={activeBirds}
								champion={championActive}
							/>{/if}
					</div>
					{#if currentRound && status !== 'ready'}
						<span
							class="multiplier-readout"
							class:pulse={multiplierPulse}
							aria-label={`${t('current')} ×${currentMultiplier.toFixed(2)}`}
							><strong>×{currentMultiplier.toFixed(2)}</strong></span
						>
					{/if}
				</div>
			{/if}
			{#if isReplay && status !== 'ready'}<div class="replay-label">{t('replayNoCost')}</div>{/if}

			{#if stageAnnouncement}
				{#key stageAnnouncement.id}
					<div class="stage-transition" role="status" aria-live="polite">
						<span>{stageWord} {stageAnnouncement.order}</span>
						<strong>{stageAnnouncement.name}</strong>
					</div>
				{/key}
			{/if}

			{#if eventWarning}
				{#key eventWarning.id}
					<EventWarning text={eventWarning.text} tone={eventWarning.tone} />
				{/key}
			{/if}

			{#if eventCallout && !eventWarning}<div
					class="event-callout"
					role="status"
					aria-live="polite"
				>
					{eventCallout}
				</div>{/if}

			{#if currentRound && status !== 'ready' && status !== 'complete'}
				<div
					class="flight-progress"
					role="progressbar"
					aria-label="Flight progress"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(flightProgress)}
					aria-valuetext={`${Math.round(flightProgress)}% · ${eventProgress}/${currentRound.events.length} · ${eventLabel}`}
				>
					<i style={`width:100%;transform:scaleX(${flightProgress / 100});transform-origin:left;`}
					></i>
					<b
						style={`left:0;width:100%;height:100%;border-radius:0;background:none;transform:translate3d(${flightProgress}%,0,0);`}
						><span class="progress-marker"></span></b
					>
				</div>
			{/if}

			{#if activeGate}
				<div
					class={`gate hazard-${activeGate.hazard} ${activeGate.result}`}
					style={`transform:translate3d(${activeGate.x}px,0,0);width:${activeGate.width}px;`}
				>
					<TerrainObstacle
						hazard={activeGate.hazard}
						stage={currentStageId}
						weather={activeWeather}
						timeOfDay={activeTimeOfDay}
						gapTop={activeGate.gapCenterY - activeGate.gapHeight / 2}
						gapBottom={activeGate.gapCenterY + activeGate.gapHeight / 2}
					/>
				</div>
			{/if}
			{#if !championActive && (!currentRound || currentRound.flock) && (status === 'ready' || status === 'flying')}
				<Hunter
					{bounds}
					shot={hunterShot}
					risk={currentRound?.risk ?? selectedRisk}
					appearance={activeHunter}
				/>
			{/if}

			{#if activePickup}
				<CollectiblePickup
					pickupType={activePickup.pickupType}
					fromMultiplier={activePickup.fromMultiplier}
					toMultiplier={activePickup.toMultiplier}
				/>
			{/if}

			{#if activeCurrent}
				<AirCurrentEffect
					currentType={activeCurrent.currentType}
					phase={activeCurrent.phase}
					multiplier={activeCurrent.multiplier}
				/>
			{/if}

			{#if activeEncounter}
				<DangerEncounter
					encounterType={activeEncounter.encounterType}
					result={activeEncounter.result}
					target={flockDangerTarget}
					phase={activeEncounter.phase}
				/>
			{/if}
			{#if birdBurst === 'playing'}
				<BirdBurst
					progress={birdBurstProgress}
					bird={activeCreature.id === 'archaeopteryx'
						? 'archaeopteryx'
						: activeCreature.id === 'azure-swift'
							? 'azure-swift'
							: activeCreature.id === 'eagle'
								? 'eagle'
								: 'woodpecker'}
					x={player.position.x}
					y={player.position.y}
				/>
			{/if}

			{#if activeEnding}<EndingEffect progress={landingProgress} />{/if}

			{#if comboFeedback}
				{#key comboFeedback.id}
					<div class="combo-feedback" role="status" aria-live="polite">
						<strong>PERFECT PASS</strong>
						{#if comboFeedback.count > 1}<span>x{comboFeedback.count} COMBO</span>{/if}
					</div>
				{/key}
			{/if}

			{#each particles as particle (particle.id)}
				<span
					class="flight-particle"
					style={`left:0;top:0;transform:translate3d(${particle.x}px,${particle.y}px,0);width:${particle.size}px;height:${particle.size}px;opacity:${Math.min(1, particle.life * 2.4)};`}
				></span>
			{/each}

			{#if currentRound?.flock && status !== 'ready' && status !== 'complete'}<div
					class="flight-speed-lines"
					class:launching={eventLabel === 'LAUNCH'}
					class:champion={championActive}
					style={`transform:translate3d(${-parallaxOffset % 90}px,0,0);`}
					aria-hidden="true"
				></div>{/if}

			<Flock
				showHealth={!currentRound || Boolean(currentRound.flock)}
				birds={activeBirds}
				frames={loadedCreatureFrames}
				hidden={birdBurst === 'playing' || birdBurst === 'finished'}
			/>
			<ChampionFlight open={championAnnouncement} />
			<p class="sr-only" role="status" aria-live="polite">{flockAnnouncement}</p>
			{#if currentRound && !currentRound.flock}<div
					class="floor"
					style={`height:${bounds.height - bounds.floorY}px;`}
				></div>{/if}

			{#if status === 'complete' && currentRound}
				<FlightResult
					round={currentRound}
					creature={activeCreature}
					title={currentRound.flock?.bonusTriggered
						? currentRound.flock.bonus?.ending === 'crash'
							? 'BONUS FAILED · BASE WIN RETAINED'
							: 'CHAMPION BONUS WON'
						: ENDING_LABELS[currentRound.ending]}
					entryCost={formatLocalAmount(currentRound.entryCost ?? currentRound.bet)}
					multiplier={finalMultiplier}
					payout={formatLocalAmount(finalWin)}
					netResult={formatLocalAmount(
						currentRound.finalWin - (currentRound.entryCost ?? currentRound.bet),
					)}
					weatherName={getWeather(currentRound.weather ?? selectedWeather).name}
					timeName={activeTimeConfig.name}
					live={wallet.live}
					replay={isReplay || replayMode}
					tubeAmount={tubeOffer ? formatLocalAmount(tubeOffer.amount) : undefined}
					tubeReason={tubeOffer?.reason ?? ''}
					onTubeFlight={playTubeFlight}
					disabled={wallet.busy || !wallet.ready || wallet.active}
					settingsDisabled={replayMode || wallet.busy || !wallet.ready || wallet.active}
					onSettings={resetPresentation}
				/>
			{/if}
		</div>

		<section
			class="control-dock"
			class:safe={selectedRisk === 'safe'}
			class:danger={selectedRisk === 'danger'}
			aria-label="Flight controls"
		>
			<button
				class="bonus-button dock-bonus"
				disabled={controlsLocked || !betInputIsValid || wallet.buyDisabled}
				data-audio-panel
				onclick={() => (bonusOpen = true)}
				><svg class="bonus-gift" viewBox="0 0 24 24" aria-hidden="true"
					><path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" /><path
						d="M12 7C5 7 5 1 8 2c2 0 4 5 4 5Zm0 0c7 0 7-6 4-5-2 0-4 5-4 5Z"
					/></svg
				>{t('bonusFlights')} <span>2 {t('routes')}</span><svg
					class="bonus-arrow"
					viewBox="0 0 16 16"
					aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg
				></button
			>

			<div class="bet-control">
				<div class="bet-heading">
					<span class="dock-label">{t('bet')}</span>{#if wallet.live}<small
							>{t('balance')}: {formatLocalAmount(wallet.amount / 1e6)}</small
						>{/if}
				</div>
				<div class="bet-stepper">
					<button
						aria-label="Decrease bet"
						disabled={controlsLocked || selectedBet <= minimumBet}
						onclick={() => moveBet(-1)}
						><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10" /></svg></button
					>
					<div
						class="bet-input-shell"
						class:invalid={!betInputIsValid}
						class:disabled={controlsLocked}
					>
						<span aria-hidden="true">{betCurrencySymbol}</span>
						<input
							aria-label="Bet amount"
							aria-invalid={!betInputIsValid}
							aria-describedby={!betInputIsValid ? 'bet-validation' : undefined}
							class="bet-input"
							disabled={controlsLocked}
							inputmode="decimal"
							type="text"
							value={displayedBetInput}
							oninput={(event) => updateBetInput(event.currentTarget as HTMLInputElement)}
							onblur={normalizeBetInput}
						/>
					</div>
					<button
						aria-label="Increase bet"
						disabled={controlsLocked || selectedBet >= maximumBet}
						onclick={() => moveBet(1)}
						><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M10 5v10" /></svg></button
					>
				</div>
			</div>

			<div class="risk-control">
				<span class="dock-label">{t('risk')}</span>
				<div class="risk-selector">
					{#each PATHS as path (path.risk)}
						<button
							type="button"
							disabled={controlsLocked}
							aria-pressed={selectedRisk === path.risk}
							data-risk={path.risk}
							class:active={selectedRisk === path.risk}
							onclick={() => (selectedRisk = path.risk)}
							><svg class="risk-mountains" viewBox="0 0 80 50" aria-hidden="true"
								><path d="M3 43 24 12 44 43z" fill="currentColor" opacity=".7" /><path
									d="M23 43 45 3 68 43z"
									fill="currentColor"
								/><path d="m45 3 0 40H23z" fill="currentColor" opacity=".55" /><path
									d="m53 43 13-22 13 22z"
									fill="currentColor"
									opacity=".8"
								/></svg
							><span>{t(path.risk)}</span><small
								>{path.risk === 'safe'
									? 'Low volatility'
									: path.risk === 'balanced'
										? 'Medium volatility'
										: 'High volatility'}</small
							></button
						>
					{/each}
				</div>
			</div>

			<button
				type="button"
				class="dock-customize"
				disabled={controlsLocked}
				aria-haspopup="dialog"
				aria-controls="customize-flight"
				aria-expanded={customizeOpen}
				data-audio-panel
				onclick={() => (customizeOpen = true)}
			>
				<svg viewBox="0 0 40 40" aria-hidden="true"
					><path d="M5 10h30M5 20h30M5 30h30" /><circle cx="26" cy="10" r="3" /><circle
						cx="13"
						cy="20"
						r="3"
					/><circle cx="22" cy="30" r="3" /></svg
				>
				<span>{t('customize')}</span>
			</button>

			{#if replayMode}
				<button
					class="fly-button"
					disabled={wallet.busy ||
						!wallet.ready ||
						!sharedReplay ||
						(status !== 'ready' && status !== 'complete')}
					onclick={() => sharedReplay && replayFlight(sharedReplay)}
					>{status === 'complete' ? t('playAgain') : t('playReplay')}</button
				>
			{:else}
				<button
					class="fly-button"
					class:launch-ready={wallet.ready && (!controlsLocked || status === 'complete')}
					class:repeat-buy={Boolean(menuOffer.bonusFlight)}
					aria-live="polite"
					disabled={(controlsLocked && status !== 'complete') ||
						wallet.busy ||
						!wallet.ready ||
						wallet.active ||
						!betInputIsValid}
					onclick={flyFromMenu}
					>{wallet.busy
						? `${t('pleaseWait')}…`
						: !wallet.ready
							? t('reconnect').toUpperCase()
							: controlsLocked && status !== 'complete'
								? t('flightActive')
								: t(menuOffer.label).toUpperCase()}<small>{formatLocalAmount(menuOffer.cost)}</small
					></button
				>
			{/if}
			<div class="bet-panel-footer" class:has-validation={!betInputIsValid}>
				<span
					class="risk-note"
					class:bet-error={!betInputIsValid}
					id="bet-validation"
					role={!betInputIsValid ? 'alert' : undefined}
					><i aria-hidden="true"></i>{!betInputIsValid
						? betValidationMessage
						: selectedPathNote}</span
				><span
					>{replayMode
						? 'Replay — no bet is placed'
						: wallet.live
							? ''
							: 'Local demo — no real-money bets.'}</span
				>
			</div>
		</section>
	</section>

	{#if wallet.error}<p role="alert">{wallet.error}</p>
		<button disabled={wallet.busy} onclick={connectStake}>{t('reconnect')}</button>{/if}
	{#if flightError}<p role="alert">{flightError}</p>{/if}
</main>

{#if winCelebrationOpen && currentRound}
	<WinCelebration
		tier={resultWinTier}
		multiplier={`x${finalMultiplier.toFixed(2)}`}
		win={winAmountFormatter.format(finalWin)}
		targetWin={winAmountFormatter.format(currentRound.finalWin)}
	/>
{/if}

<HelpDialog live={wallet.live} open={helpOpen} onClose={() => (helpOpen = false)} />
<BonusFlightsDialog
	live={wallet.live}
	currency={wallet.currency}
	open={bonusOpen}
	bet={selectedBet}
	disabled={controlsLocked || !betInputIsValid || wallet.buyDisabled}
	onClose={() => (bonusOpen = false)}
	onBuy={startFlight}
/>
<FlightHistory
	currency={wallet.currency}
	open={historyOpen}
	rounds={flightHistory}
	disabled={wallet.busy ||
		!wallet.ready ||
		wallet.active ||
		(status !== 'ready' && status !== 'complete')}
	onClose={() => (historyOpen = false)}
	onReplay={replayFlight}
/>

<CustomizeDrawer
	open={customizeOpen}
	disabled={controlsLocked}
	weather={selectedWeather}
	timeOfDay={selectedRisk === 'safe' ? 'day' : selectedTimeOfDay}
	launchStyle={selectedLaunchStyle}
	lineup={selectedLineup}
	hunter={selectedHunter}
	risk={selectedRisk}
	onHunterSelect={(hunter) => {
		if (!controlsLocked && !wallet.busy && !wallet.active) selectedHunter = hunter;
	}}
	onLineupSelect={chooseLineupBird}
	timeLocked={selectedRisk === 'safe'}
	onTimeSelect={(time) => {
		selectedTimeOfDay = time;
	}}
	onLaunchSelect={(launch) => (selectedLaunchStyle = launch)}
	onClose={() => (customizeOpen = false)}
/>

<style>
	.flight-speed-lines {
		position: absolute;
		inset: 100px -90px 40px;
		pointer-events: none;
		z-index: 8;
		opacity: 0.07;
		background: repeating-linear-gradient(
			0deg,
			transparent 0 33px,
			#d7edff 34px 35px,
			transparent 36px 74px
		);
		mask-image: linear-gradient(
			90deg,
			transparent,
			#0002 12%,
			transparent 25%,
			transparent 68%,
			#0008 90%,
			transparent
		);
	}
	.flight-speed-lines.champion {
		opacity: 0.025;
	}
	@media (prefers-reduced-motion: reduce) {
		.flight-speed-lines {
			display: none;
		}
	}
	.flight-speed-lines.launching {
		opacity: 0.2;
	}

	.flock-hud-group {
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		gap: 6px;
	}
	.prototype-shell,
	.prototype-shell * {
		box-sizing: border-box;
	}
	.prototype-shell {
		position: fixed;
		inset: 0;
		z-index: 1000;
		overflow: auto;
		padding: clamp(16px, 2.5vw, 34px);
		color: #dce6e3;
		font-family: system-ui, sans-serif;
		background:
			radial-gradient(ellipse at 50% 0, #29414b, transparent 70%),
			linear-gradient(145deg, #111f27, #0b171d);
	}
	.prototype-header,
	.game-layout,
	.control-dock {
		width: min(1440px, 100%);
		margin-inline: auto;
	}
	.prototype-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: clamp(8px, 1vh, 14px);
	}
	h1 {
		margin: 0;
		color: #e6eee9;
		font-size: clamp(1.3rem, 2.4vw, 2.2rem);
		letter-spacing: 0.04em;
		text-shadow: 0 2px 18px rgba(246, 157, 42, 0.26);
	}
	.game-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(290px, 360px);
		gap: clamp(14px, 2vw, 26px);
	}
	.world {
		position: relative;
		min-width: 0;
		min-height: clamp(420px, 68dvh, 730px);
		overflow: hidden;
		border: 1px solid #718b91;
		border-radius: 12px;
		box-shadow:
			inset 0 0 0 5px #071811,
			inset 0 0 45px #000,
			0 18px 50px rgba(0, 0, 0, 0.45);
		background: linear-gradient(#07100f, #0d1913 64%, #17100a);
	}
	.world.has-impact {
		animation: impact-shake calc(0.4s / var(--playback-speed, 1)) ease-out;
	}
	.gate {
		position: absolute;
		z-index: 3;
		inset-block: 0;
	}
	.flight-particle {
		position: absolute;
		z-index: 7;
		border-radius: 50%;
		background: #d3e5db;
		box-shadow: 0 0 5px #c7dfd366;
		pointer-events: none;
	}
	.floor {
		position: absolute;
		z-index: 5;
		left: 0;
		right: 0;
		bottom: 0;
		border-top: 2px solid #7a927b;
		overflow: hidden;
		background: #293e36;
	}
	.floor::before {
		content: '';
		position: absolute;
		inset: 0 -180px 0 0;
		background: repeating-linear-gradient(165deg, #293e36 0 22px, #31473e 23px 43px);
		transform: translate3d(var(--floor-scroll), 0, 0);
	}
	.has-ending .floor {
		opacity: 0;
	}
	button {
		min-height: 42px;
		border-radius: 6px;
		border: 1px solid #536d70;
		background: linear-gradient(#10231a, #09130f);
		color: #ceded9;
		font:
			700 0.8rem/1 system-ui,
			sans-serif;
		cursor: pointer;
		transition: 0.13s;
	}
	button:hover:not(:disabled),
	button:focus-visible,
	button.active {
		border-color: #9dc5ad;
		color: #c3deca;
		box-shadow:
			inset 0 0 13px rgba(26, 221, 133, 0.16),
			0 0 12px rgba(26, 221, 133, 0.12);
		outline: none;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}
	.fly-button {
		border-color: #2cce86;
		background: linear-gradient(#188457, #0b4b33);
		color: #f2f4e7;
		font-family: system-ui, sans-serif;
		letter-spacing: 0.14em;
		box-shadow:
			inset 0 0 20px rgba(68, 255, 165, 0.16),
			0 0 18px rgba(20, 197, 117, 0.16);
	}
	@keyframes flap-top {
		50% {
			transform: rotate(-30deg) scaleY(0.5);
		}
	}
	@keyframes flap-bottom {
		50% {
			transform: rotate(30deg) scaleY(0.5);
		}
	}
	@keyframes impact-shake {
		20% {
			transform: translate(-8px, 3px);
		}
		40% {
			transform: translate(7px, -3px);
		}
		60% {
			transform: translate(-5px, 2px);
		}
		80% {
			transform: translate(3px, -1px);
		}
	}
	@media (max-width: 620px) {
		.event-callout {
			top: 27%;
			width: max-content;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.world.has-impact {
			animation: none;
		}
	}
	.bet-stepper {
		display: grid;
		grid-template-columns: 54px 1fr 54px;
		align-items: center;
		gap: 10px;
	}
	.bet-stepper button {
		height: 48px;
		border-radius: 50%;
		font-size: 1.35rem;
	}
	.bet-input-shell {
		display: flex;
		min-width: 0;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 0 12px;
		border: 1px solid rgba(199, 153, 63, 0.45);
		background: rgba(0, 0, 0, 0.22);
		color: #f2d594;
	}
	.bet-input-shell > span {
		font:
			700 1rem/1 system-ui,
			sans-serif;
	}
	.bet-input {
		min-width: 0;
		width: 7ch;
		padding: 12px 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: #f2d594;
		font:
			700 1rem/1 system-ui,
			sans-serif;
		text-align: left;
	}
	.bet-input-shell:focus-within {
		border-color: #9dc5ad;
		outline: 2px solid rgba(73, 229, 156, 0.25);
		outline-offset: 1px;
	}
	.bet-input-shell.invalid {
		border-color: #c65c3a;
		box-shadow: inset 0 0 12px rgba(198, 92, 58, 0.16);
	}
	.bet-input-shell.disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}
	.event-callout {
		position: absolute;
		z-index: 10;
		left: 50%;
		top: 19%;
		max-width: 82%;
		padding: 8px 14px;
		border: 0;
		border-radius: 0;
		background: rgba(8, 21, 14, 0.82);
		color: #f2c86d;
		font:
			800 0.68rem/1.2 'Google Sans',
			sans-serif;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		text-align: center;
		text-shadow: none;
		transform: translateX(-50%);
		pointer-events: none;
	}
	.world:has(.event-callout) .event-callout {
		animation: event-callout-in calc(0.24s / var(--playback-speed, 1)) ease-out;
	}
	@keyframes event-callout-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.stage-transition {
		position: absolute;
		z-index: 12;
		top: 31%;
		left: 50%;
		display: grid;
		gap: 6px;
		width: min(430px, 78%);
		padding: 14px 18px;
		border: 1px solid rgba(208, 170, 96, 0.7);
		border-radius: 16px;
		box-shadow:
			inset 0 0 0 3px #c9963514,
			0 10px 28px #0004;
		backdrop-filter: blur(8px);
		background: var(--glass-background);
		text-align: center;
		pointer-events: none;
		transform: translateX(-50%);
		animation: stage-transition-in calc(1.05s / var(--playback-speed, 1)) ease both;
	}
	.stage-transition span {
		color: #d0ad73;
		font:
			800 0.58rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.2em;
	}
	.stage-transition strong {
		color: #f4cd78;
		font-size: clamp(1rem, 2.5vw, 1.55rem);
		letter-spacing: 0.055em;
		text-transform: uppercase;
		text-shadow: 0 2px 15px #000;
	}
	@keyframes stage-transition-in {
		0% {
			opacity: 0;
			transform: translate(-50%, 10px) scale(0.96);
		}
		18%,
		72% {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -7px) scale(1.02);
		}
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.help-button {
		display: grid;
		place-items: center;
		width: 44px;
		min-height: 44px;
		padding: 9px;
		border: 1px solid #b57e2c;
		border-radius: 50%;
		background: rgba(3, 19, 13, 0.86);
		color: #f3c96e;
	}
	.help-button svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.8;
	}
	@media (max-width: 620px) {
		.header-actions {
			gap: 7px;
		}
		.help-button {
			width: 40px;
			min-height: 40px;
			padding: 8px;
		}
		.stage-transition {
			top: 32%;
			padding: 10px 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stage-transition {
			animation: none;
		}
	}
	.multiplier-readout.pulse {
		animation: multiplier-hud-pulse calc(0.46s / var(--playback-speed, 1)) ease-out;
	}
	.multiplier-readout.pulse strong {
		text-shadow: 0 0 14px #70ffba;
	}
	.combo-feedback {
		position: absolute;
		z-index: 14;
		top: 34%;
		left: 27%;
		display: grid;
		gap: 4px;
		min-width: 128px;
		padding: 8px 12px;
		border-left: 2px solid #5bf1aa;
		background: linear-gradient(90deg, rgba(4, 34, 23, 0.92), transparent);
		color: #7af2b5;
		text-shadow: 0 2px 9px #000;
		pointer-events: none;
		animation: combo-pop calc(0.68s / var(--playback-speed, 1)) ease-out both;
	}
	.combo-feedback strong {
		color: #e2e9df;
		font:
			900 0.65rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.12em;
	}
	.combo-feedback span {
		font:
			900 0.58rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.16em;
	}
	@keyframes multiplier-hud-pulse {
		35% {
			color: #baffd7;
		}
	}
	@keyframes combo-pop {
		0% {
			opacity: 0;
			transform: translate(-12px, 8px) scale(0.88);
		}
		24%,
		72% {
			opacity: 1;
			transform: translate(0, 0) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(12px, -8px) scale(1.03);
		}
	}
	@media (max-width: 620px) {
		.combo-feedback {
			top: 37%;
			left: 18%;
			min-width: 110px;
			padding: 6px 9px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.multiplier-readout.pulse,
		.combo-feedback {
			animation: none;
		}
	}

	/* Compact setup deck: the flight scene remains primary while setup stays viewport-bound. */
	.prototype-shell {
		padding: clamp(10px, 1.5vw, 22px);
	}
	.prototype-header {
		align-items: center;
		margin-bottom: clamp(8px, 1.2vh, 14px);
	}

	.prototype-header h1 {
		margin-top: 2px;
		font-size: clamp(1.45rem, 2.45vw, 2.45rem);
	}

	.help-button {
		width: 38px;
		min-height: 38px;
		padding: 8px;
	}
	.help-button svg {
		width: 19px;
		height: 19px;
	}

	.game-layout {
		--game-panel-height: clamp(430px, calc(100dvh - 112px), 760px);
		grid-template-columns: minmax(0, 4fr) minmax(270px, 1fr);
		gap: clamp(10px, 1.35vw, 20px);
		align-items: stretch;
	}
	.world {
		height: var(--game-panel-height);
		min-height: 0;
	}

	.bet-stepper {
		grid-template-columns: 42px minmax(0, 1fr) 42px;
		gap: 7px;
	}
	.bet-stepper button {
		width: 42px;
		height: 42px;
		min-height: 42px;
		font-size: 1.1rem;
	}
	.bet-input {
		padding: 10px 6px;
		font-size: 0.93rem;
	}

	.fly-button {
		min-height: 56px;
		margin: 0;
		padding: 8px;
		font-size: clamp(0.88rem, 1.3vw, 1.08rem);
		letter-spacing: 0.11em;
	}

	@media (max-width: 900px) {
		.game-layout {
			--game-panel-height: clamp(390px, 58dvh, 560px);
			grid-template-columns: 1fr;
		}

		.world {
			height: var(--game-panel-height);
			min-height: 0;
		}
	}

	@media (max-width: 620px) {
		.prototype-shell {
			padding: 9px;
		}
		.prototype-header {
			flex-wrap: nowrap;
			gap: 8px;
		}

		.prototype-header h1 {
			margin: 0;
			font-size: clamp(1.15rem, 5.8vw, 1.65rem);
		}
		.header-actions {
			flex: 0 0 auto;
		}

		.help-button {
			width: 34px;
			min-height: 34px;
			padding: 7px;
		}
		.game-layout {
			--game-panel-height: clamp(340px, 55dvh, 470px);
			gap: 10px;
		}
	}

	@media (max-width: 390px) {
		.fly-button {
			min-height: 50px;
		}
	}

	/* Main game layout and compact flight dock. */
	.prototype-shell {
		display: flex;
		height: 100dvh;
		min-height: 0;
		flex-direction: column;
		overflow-x: hidden;
		overflow-y: auto;
		padding: clamp(8px, 1.2vw, 18px);
	}
	.prototype-header {
		align-items: center;
		flex: 0 0 auto;
		margin-bottom: 8px;
	}
	.prototype-header h1 {
		margin: 0;
		font-size: clamp(1.25rem, 2.25vw, 2rem);
	}
	.header-actions {
		margin-left: auto;
	}
	.header-button {
		min-height: 36px;
		padding: 7px 13px;
		border-color: #627e81;
		background: rgba(4, 20, 14, 0.82);
		color: #d8e5e0;
		font-size: 0.58rem;
		letter-spacing: 0.13em;
	}
	.help-button {
		width: 36px;
		min-height: 36px;
		padding: 7px;
	}

	.game-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(280px, 1fr) auto;
		/* Preserve the playable world height; short windows scroll the shell. */
		flex: 1 0 auto;
		min-width: 0;
		min-height: 0;
		gap: 9px;
	}
	.world {
		width: 100%;
		height: auto;
		min-height: 0;
	}

	.control-dock {
		position: relative;
		display: grid;
		grid-template-columns: minmax(120px, 200px) minmax(140px, 220px) minmax(250px, 1fr) minmax(
				170px,
				240px
			);
		align-items: start;
		gap: clamp(8px, 1.2vw, 16px);
		flex: 0 0 auto;
		padding: 10px clamp(10px, 1.5vw, 18px);
		border-radius: 3px;
		background: #141b21;
	}
	.dock-label {
		display: block;
		margin-bottom: 6px;
		color: #7b8592;
		font:
			800 0.5rem/1 system-ui,
			sans-serif;
		letter-spacing: 0.16em;
	}
	.risk-selector {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		box-sizing: border-box;
		height: 48px;
		padding: 4px;
		border-radius: 3px;
		background: #0b1015;
	}
	.risk-selector button {
		min-height: 40px;
		border-radius: 3px;
		background: transparent;
		color: #89929e;
		padding: 6px 4px;
		font-size: 0.59rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.risk-selector button.active {
		background: #557762;
		color: #fff;
	}
	.bet-control .bet-stepper {
		grid-template-columns: 42px minmax(90px, 1fr) 42px;
		gap: 0;
		height: 48px;
		overflow: hidden;
		border-radius: 3px;
		background: #0b1015;
	}
	.bet-control .bet-stepper button {
		display: grid;
		place-items: center;
		padding: 0;
		line-height: 1;
		letter-spacing: 0;
		width: 42px;
		height: 48px;
		min-height: 48px;
		border-radius: 0;
		background: transparent;
		color: #9ca3af;
	}
	.bet-control .bet-stepper button:hover:not(:disabled) {
		background: #16212b;
	}
	.bet-stepper button svg {
		width: 20px;
		height: 20px;
		display: block;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}
	.bet-control .bet-input-shell {
		height: 48px;
		box-sizing: border-box;
		padding: 0 3px;
		background: transparent;
		color: #e5e7eb;
	}
	.bet-control .bet-input {
		padding: 7px 0;
		font-size: 1.05rem;
		width: 5ch;
		max-width: 100%;
		color: #e5e7eb;
	}
	.control-dock .fly-button {
		width: 100%;
		min-height: 48px;
		margin: 14px 0 0;
		border-radius: 3px;
		background: linear-gradient(#6b9a7a, #4e795c);
		color: #fff;
		font-size: 1rem;
	}

	@media (max-height: 720px) and (min-width: 701px) {
		.prototype-shell {
			padding-block: 7px;
		}
		.prototype-header {
			margin-bottom: 6px;
		}
		.prototype-header h1 {
			font-size: 1.2rem;
		}
		.control-dock {
			padding-block: 7px;
		}
	}

	@media (max-width: 1000px) {
		.control-dock {
			grid-template-columns: minmax(140px, 0.8fr) minmax(205px, 1fr) minmax(270px, 1.45fr);
		}
		.control-dock .fly-button {
			grid-column: 1 / -1;
			min-height: 50px;
			margin-top: 0;
		}
	}

	@media (max-width: 700px) {
		.prototype-shell {
			padding: 7px;
		}
		.prototype-header {
			margin-bottom: 6px;
		}
		.prototype-header h1 {
			font-size: 1.15rem;
		}
		.header-button {
			min-height: 32px;
			padding: 6px 9px;
			font-size: 0.5rem;
		}
		.help-button {
			width: 32px;
			min-height: 32px;
			padding: 6px;
		}
		.game-layout {
			grid-template-rows: minmax(262px, 1fr) auto;
			gap: 7px;
		}
		.control-dock {
			grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
			gap: 7px;
			padding: 8px;
		}
		.bet-control {
			grid-column: 2;
		}
		.risk-control {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.control-dock .fly-button {
			grid-column: 1 / -1;
			grid-row: 3;
			min-height: 48px;
		}
	}

	@media (max-width: 390px) {
		.dock-label {
			margin-bottom: 4px;
		}
		.bet-control .bet-stepper {
			grid-template-columns: 36px minmax(0, 1fr) 36px;
			gap: 0;
			height: 40px;
		}
		.bet-control .bet-stepper button {
			width: 36px;
			height: 40px;
			min-height: 40px;
		}
		.bet-control .bet-input-shell {
			height: 40px;
		}
		.bet-control .bet-input {
			font-size: 0.9rem;
		}
		.risk-selector button {
			min-height: 35px;
			font-size: 0.53rem;
		}
		.control-dock .fly-button {
			min-height: 44px;
		}
	}
	.playback-control,
	.language-control {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.65rem;
		color: #d8e5e0;
	}
	.playback-control select,
	.language-control select {
		min-height: 36px;
		padding: 4px 6px;
		border: 1px solid #627e81;
		border-radius: 6px;
		background: #102725;
		color: #d8e5e0;
		font: inherit;
	}
	.playback-control select:focus-visible,
	.language-control select:focus-visible {
		outline: 2px solid #64efbd;
		outline-offset: 2px;
	}
	.playback-control select:disabled {
		opacity: 0.55;
	}
	.language-control select {
		max-width: 112px;
	}
	@media (max-width: 480px) {
		.prototype-header {
			flex-wrap: wrap;
			gap: 6px;
		}
		.prototype-header h1 {
			flex-basis: 100%;
		}
		.header-actions {
			width: 100%;
		}
		.playback-control {
			margin-right: auto;
		}
	}
	.flight-extras {
		display: flex;
		flex: 0 0 auto;
		gap: 8px;
		padding-top: 8px;
	}
	.flight-extras button {
		padding: 10px 16px;
		font-size: 0.65rem;
		letter-spacing: 0.07em;
	}
	.flight-extras span {
		margin-left: 8px;
		font-size: 0.65rem;
		color: #afc9c3;
	}
	.flight-extras .bonus-button {
		border-color: #d8ba75;
		color: #ffe2a2;
		background: #2b342b;
	}
	.replay-label {
		position: absolute;
		top: 84px;
		left: 12px;
		z-index: 20;
		padding: 7px 10px;
		border-radius: 6px;
		background: #0d292deb;
		color: #b9eadb;
		font-size: 0.65rem;
	}
	@media (max-width: 480px) {
		.flight-extras button {
			flex: 1;
			padding-inline: 8px;
		}
	}
	.prototype-header {
		flex-wrap: wrap;
		gap: 12px 20px;
	}
	.control-tools {
		flex: 1 1 550px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		width: auto;
		margin: 0 0 0 auto;
		padding: 0;
	}
	.control-tools button {
		min-height: 40px;
		flex: 0 0 auto;
	}
	.control-tools .playback-control {
		order: 1;
		margin: 0;
	}
	.control-tools .help-button {
		order: 2;
		padding: 8px;
		width: 40px;
	}
	.prototype-header h1 {
		letter-spacing: 0.01em;
		text-shadow: none;
	}
	.control-tools button,
	.control-tools select {
		border: 0;
		border-radius: 3px;
		background: #0b1015;
		box-shadow: none;
		text-shadow: none;
		color: #e6eee9;
	}
	.control-tools button {
		padding: 10px 14px;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
	}
	.control-tools button:hover:not(:disabled),
	.control-tools select:hover:not(:disabled) {
		background-color: #1c2b31;
	}
	.control-tools button[aria-expanded='true'] {
		background: #557e69;
	}
	.control-tools .bonus-button {
		color: #f3cc7d;
	}
	.control-tools .help-button {
		padding: 10px;
		color: #f3cc7d;
	}
	.control-tools select {
		min-height: 40px;
		padding: 8px 30px 8px 12px;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='m4 6 4 4 4-4' stroke='%2394a6b1' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 11px center;
		background-size: 12px 12px;
	}
	.control-tools label {
		gap: 7px;
		color: #94a6b1;
	}
	.control-tools label span {
		margin-left: 0;
		color: inherit;
	}
	.control-tools button:focus-visible {
		outline: 2px solid #8cbca1;
		outline-offset: 2px;
	}
	@media (max-width: 480px) {
		.control-tools {
			gap: 8px;
			justify-content: flex-start;
		}
		.control-tools .header-button,
		.control-tools .bonus-button {
			flex: 1 1 auto;
		}
	}
	.control-dock {
		grid-template-columns: minmax(140px, 1fr) minmax(230px, 1.5fr) minmax(190px, 1.1fr) 150px 170px;
		grid-template-areas: 'risk bet customize action' 'details details details details';
		align-items: end;
		gap: 14px 18px;
		padding: 16px;
		border-radius: 8px;
		background: #16212b;
		--risk-color: #10b981;
	}
	.control-dock.safe {
		--risk-color: #3b82f6;
	}
	.control-dock.danger {
		--risk-color: #ef4444;
	}
	.risk-control {
		grid-area: risk;
		min-width: 0;
	}
	.bet-control {
		grid-area: bet;
		min-width: 0;
	}
	.control-dock .dock-label {
		margin-bottom: 7px;
		color: #9ba9b7;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
	}
	.bet-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.bet-heading small {
		color: #9ba9b7;
		font-size: 0.6rem;
		white-space: nowrap;
	}
	.control-dock .risk-selector {
		height: 48px;
		background: #131c25;
		border-radius: 6px;
	}
	.control-dock .risk-selector button {
		min-height: 40px;
		font-size: 0.67rem;
		letter-spacing: 0.04em;
	}
	.control-dock .risk-selector button.active {
		background: var(--risk-color);
	}
	.control-dock .bet-stepper {
		height: 48px;
		border-radius: 6px;
		background: #131c25;
		grid-template-columns: 40px minmax(0, 1fr) 40px;
	}
	.control-dock .bet-stepper button {
		width: 40px;
		height: 48px;
		min-height: 48px;
	}
	.control-dock .bet-input-shell {
		height: 48px;
	}
	.control-dock .bet-input {
		font-size: 1.15rem;
	}
	.control-dock button:focus-visible {
		outline: 2px solid #41f0a5;
		outline-offset: 2px;
	}
	.control-dock .fly-button {
		grid-area: action;
		margin: 0;
		min-height: 48px;
		border-radius: 6px;
		background: #059669;
		font-size: 1.05rem;
		letter-spacing: 0.05em;
	}
	.control-dock .fly-button:hover:not(:disabled) {
		background: #10b981;
	}
	.bet-panel-footer {
		grid-area: details;
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding-top: 10px;
		color: #9ba9b7;
		font-size: 0.65rem;
		line-height: 1.45;
	}
	.risk-note {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.risk-note i {
		width: 6px;
		height: 6px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--risk-color);
	}
	.bet-error {
		color: #ffaaa0;
	}
	.bet-error i {
		background: #ffaaa0;
	}

	/* Gold framed controls matching the supplied reference. */
	.prototype-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		position: relative;
		gap: 16px;
		padding: 8px 12px;
	}
	.header-balance {
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		border: 1px solid #56616a;
		border-radius: 16px;
		background: #0b121add;
	}
	.header-balance div {
		display: grid;
		gap: 3px;
	}
	.header-balance span {
		font-size: 0.8rem;
		color: #c3c6c7;
	}
	.header-balance strong {
		font-size: 1.2rem;
		font-variant-numeric: tabular-nums;
	}
	.header-balance .currency-medallion {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid #f6d47d;
		background: #bb7b19;
		color: #ffe7a1;
		font-size: 1rem;
		font-weight: 800;
	}
	.prototype-header .flight-title {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #efc16d;
		font-family: Georgia, serif !important;
		font-size: clamp(1.5rem, 2.8vw, 2.5rem);
		text-align: center;
		text-transform: uppercase;
		line-height: 0.95;
		letter-spacing: 0.05em;
	}
	.flight-title > span:last-child {
		transform: scaleX(-1);
	}
	.flight-title > span:first-child,
	.flight-title > span:last-child {
		width: clamp(30px, 4vw, 60px);
	}
	.prototype-header .flight-title span {
		font-family: Georgia, serif !important;
	}
	.flight-title svg {
		width: 100%;
		fill: none;
		stroke: #dcae5f;
		stroke-width: 3;
		stroke-linecap: round;
	}
	.top-icons {
		display: flex;
		justify-self: end;
		border: 1px solid #56616a;
		border-radius: 16px;
		padding: 6px;
		background: #0b121add;
	}
	.top-icons button {
		display: grid;
		place-items: center;
		width: 48px;
		height: 44px;
		padding: 10px;
		background: transparent;
		border: 0;
		border-radius: 8px;
		color: #cdd4db;
	}
	.top-icons button:hover {
		background: #ffffff12;
		color: #ffe0a1;
	}
	.top-icons svg {
		width: 24px;
		height: 24px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.prototype-header .control-tools {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 70;
		width: min(440px, calc(100vw - 32px));
		padding: 16px;
		margin: 0;
		border: 1px solid #736044;
		border-radius: 12px;
		background: #0c151ff7;
		box-shadow: 0 12px 40px #0008;
		justify-content: flex-start;
	}
	.control-tools[hidden] {
		display: none;
	}
	.control-dock {
		grid-template-columns: minmax(0, 1.45fr) minmax(0, 1.05fr) minmax(0, 0.95fr) 112px minmax(
				145px,
				0.75fr
			);
		grid-template-areas: 'risk bet customize action' 'bonus details details details';
		align-items: stretch;
		gap: 12px 20px;
		padding: 20px;
		border: 1px solid #99703b;
		border-radius: 24px;
		background: linear-gradient(135deg, #101a20f5, #080e12fa);
		box-shadow:
			inset 0 0 0 5px #c9963520,
			0 10px 28px #0004;
	}
	.control-dock .dock-label {
		font-size: 0.85rem;
		letter-spacing: 0.035em;
		font-weight: 500;
		color: #dfc8a9;
		margin-bottom: 16px;
	}
	.risk-control,
	.bet-control {
		min-width: 0;
	}
	.control-dock .risk-selector {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		height: calc(100% - 32px);
		min-height: 140px;
		padding: 0;
		background: transparent;
	}
	.control-dock .risk-selector button {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 8px;
		padding: 10px 4px;
		border: 1px solid #56616a;
		border-radius: 12px;
		background: linear-gradient(#182127, #090f13);
		color: #e2e2de;
		text-transform: none;
		font-size: 0.85rem;
		letter-spacing: 0;
	}
	.risk-mountains {
		width: 62px;
		max-width: 85%;
		height: 48px;
		color: #eeba59;
	}
	button[data-risk='safe'] .risk-mountains {
		color: #79c58d;
	}
	button[data-risk='danger'] .risk-mountains {
		color: #e17b4c;
	}
	.control-dock .risk-selector button.active {
		border: 2px solid #ffd471;
		background: linear-gradient(#342919, #18140e);
		box-shadow: 0 0 16px #f7b52d44;
	}
	.risk-selector small {
		color: #9aa2a6;
		font-size: 0.6rem;
		line-height: 1.3;
		text-align: center;
	}
	.control-dock .bet-stepper {
		height: 62px;
		gap: 6px;
		grid-template-columns: 48px minmax(0, 1fr) 48px;
		background: transparent;
	}
	.control-dock .bet-stepper button {
		width: 48px;
		height: 62px;
		min-height: 62px;
		border: 1px solid #535b5f;
		border-radius: 12px;
		background: linear-gradient(#272d31, #14191d);
		color: #e2e2de;
	}
	.control-dock .bet-input-shell {
		height: 62px;
		border: 1px solid #3c474e;
		border-radius: 12px;
		background: #090f13;
	}
	.control-dock .bet-input {
		font-size: 1.25rem;
		color: #f7f5ed;
	}
	.control-dock .bet-input-shell > span {
		color: #f7c564;
	}
	.bet-heading {
		flex-wrap: wrap;
	}
	.control-dock .fly-button {
		grid-area: action;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 168px;
		margin: 0;
		padding: 16px;
		border: 2px solid #ffe8a3;
		border-radius: 20px;
		color: #472605;
		background: linear-gradient(145deg, #ffda70, #f2af2d 55%, #c47812);
		box-shadow:
			inset 0 0 0 3px #ffdf7d55,
			0 0 22px #e8a32644;
		font-size: clamp(1.1rem, 2vw, 2rem);
		letter-spacing: 0.04em;
		text-shadow: 0 1px #ffe8a1;
	}
	.control-dock .fly-button.launch-ready {
		font-size: clamp(2rem, 3.7vw, 3.4rem);
		font-weight: 900;
	}
	.control-dock .fly-button.launch-ready.repeat-buy {
		font-size: clamp(1rem, 2vw, 1.8rem);
	}
	.control-dock .fly-button small {
		display: block;
		padding: 8px 12px;
		border-radius: 10px;
		background: #74420c33;
		color: #fff7dd;
		font-size: 1.1rem;
		letter-spacing: 0;
		text-shadow: 0 1px 2px #62380b;
	}
	.control-dock .fly-button:hover:not(:disabled) {
		background: linear-gradient(145deg, #ffe59a, #ffc147 55%, #dd931f);
	}
	.control-dock button:focus-visible {
		outline-color: #ffe0a1;
	}
	.control-dock .dock-customize {
		grid-area: customize;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		min-height: 168px;
		padding: 16px 8px;
		border: 1px solid #56616a;
		border-radius: 18px;
		background: linear-gradient(#182127, #090f13);
		color: #dfc8a9;
		font-size: 0.75rem;
		letter-spacing: 0.025em;
	}
	.dock-customize svg {
		width: 36px;
		height: 36px;
		fill: #111a20;
		stroke: #dfbc85;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.control-dock .dock-customize:hover:not(:disabled) {
		border-color: #e1bb76;
		background: #1b252b;
	}
	@media (max-width: 700px) {
		.control-dock .dock-customize {
			flex-direction: row;
			gap: 10px;
			min-height: 48px;
			padding: 8px 12px;
			border-radius: 10px;
		}
		.dock-customize svg {
			width: 26px;
			height: 26px;
		}
	}
	.control-dock .dock-bonus {
		grid-area: bonus;
		min-height: 32px;
		align-self: center;
		justify-self: start;
		padding: 6px 10px;
		border: 1px solid #755931;
		border-radius: 6px;
		background: #151b1e;
		color: #dfb66d;
		font-size: 0.65rem;
	}
	.dock-bonus span {
		margin-left: 6px;
	}
	.bet-panel-footer {
		align-self: center;
		padding-top: 0;
	}
	@media (max-width: 1100px) {
		.control-dock {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 112px minmax(145px, 0.8fr);
			grid-template-areas: 'risk risk risk risk' 'bet bet customize action' 'bonus details details details';
			gap: 14px;
			padding: 16px;
		}
		.control-dock .risk-selector {
			min-height: 132px;
		}
		.control-dock .fly-button {
			min-height: 160px;
		}
	}
	@media (max-width: 700px) {
		.prototype-header {
			grid-template-columns: 1fr auto;
			gap: 10px;
			padding: 4px 0;
		}
		.prototype-header .flight-title {
			grid-column: 1 / -1;
			grid-row: 1;
			justify-self: center;
			font-size: 1.8rem;
		}
		.header-balance {
			grid-row: 2;
			padding: 6px 10px;
			gap: 8px;
		}
		.header-balance strong {
			font-size: 1rem;
		}
		.top-icons {
			grid-row: 2;
		}
		.top-icons button {
			width: 40px;
			height: 38px;
		}
		.control-dock {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas: 'risk risk' 'bet action' 'customize customize' 'bonus bonus' 'details details';
			padding: 14px;
			gap: 14px;
			border-radius: 18px;
		}
		.control-dock .dock-label {
			margin-bottom: 10px;
			font-size: 0.75rem;
		}
		.control-dock .risk-selector {
			min-height: 110px;
			height: auto;
		}
		.control-dock .risk-selector button {
			gap: 5px;
		}
		.risk-mountains {
			height: 36px;
		}
		.control-dock .fly-button {
			min-height: 136px;
			padding: 8px;
			font-size: 1.05rem;
		}
		.control-dock .fly-button.launch-ready {
			font-size: 2.4rem;
		}
		.control-dock .bet-stepper {
			grid-template-columns: 30px minmax(0, 1fr) 30px;
			height: 48px;
		}
		.control-dock .bet-stepper button {
			width: 30px;
			height: 48px;
			min-height: 48px;
		}
		.control-dock .bet-input-shell {
			height: 48px;
		}
		.control-dock .bet-input {
			font-size: 1rem;
		}
		.bet-panel-footer {
			flex-direction: column;
			gap: 4px;
		}
	}
	.world .prototype-header {
		position: absolute;
		top: 12px;
		left: 12px;
		right: 12px;
		/* Keep settings/history usable above the inline result card (z-index 100). */
		z-index: 120;
		width: auto;
		margin: 0;
		padding: 0;
		pointer-events: none;
	}
	.world .prototype-header .header-balance,
	.world .prototype-header .top-icons,
	.world .prototype-header .control-tools {
		pointer-events: auto;
	}
	.world .replay-label {
		top: 152px;
	}
	@media (max-width: 700px) {
		.world .prototype-header {
			top: 10px;
			left: 10px;
			right: 10px;
		}
		.world .replay-label {
			top: 200px;
		}
	}
	/* Keep the scene compact and leave the bird unobstructed on phones. */
	.game-layout {
		flex: 0 0 auto;
		grid-template-rows: auto auto;
	}
	.world {
		height: clamp(300px, 45dvh, 480px);
	}
	.header-balance,
	.top-icons {
		background: rgba(9, 18, 26, 0.64);
		border-color: rgba(178, 193, 205, 0.3);
		backdrop-filter: blur(8px);
	}
	@media (max-width: 700px) {
		.world {
			height: clamp(300px, 35dvh, 340px);
		}
		.world .prototype-header {
			grid-template-columns: auto minmax(0, 1fr) auto;
			gap: 6px;
			align-items: center;
		}
		.world .prototype-header .header-balance {
			grid-column: 1;
			grid-row: 1;
			padding: 6px 8px;
			gap: 6px;
			border-radius: 12px;
		}
		.header-balance span {
			font-size: 0.58rem;
		}
		.header-balance strong {
			font-size: 0.85rem;
		}
		.header-balance .currency-medallion {
			width: 22px;
			height: 22px;
			font-size: 0.75rem;
		}
		.world .prototype-header .flight-title {
			grid-column: 2;
			grid-row: 1;
			gap: 3px;
			font-size: clamp(0.85rem, 3.6vw, 1.2rem);
		}
		.flight-title > span:first-child,
		.flight-title > span:last-child {
			width: 12px;
		}
		.world .prototype-header .top-icons {
			grid-column: 3;
			grid-row: 1;
			padding: 3px;
			border-radius: 12px;
		}
		.top-icons button {
			width: 32px;
			height: 36px;
			padding: 6px;
		}
		.top-icons svg {
			width: 20px;
			height: 20px;
		}
		.world .replay-label {
			top: 64px;
		}
	}
	.bonus-gift,
	.bonus-arrow {
		display: none;
	}
	@media (max-width: 700px) {
		.control-dock {
			gap: 10px;
			padding: 12px;
		}
		.control-dock .dock-label {
			margin-bottom: 7px;
			font-size: 0.65rem;
		}
		.control-dock .risk-selector {
			min-height: 78px;
			gap: 8px;
		}
		.control-dock .risk-selector button {
			padding: 7px 3px;
			gap: 3px;
			border-radius: 9px;
			font-size: 0.7rem;
		}
		.risk-mountains {
			height: 30px;
		}
		.risk-selector small {
			font-size: 0.5rem;
		}
		.bet-heading small {
			display: none;
		}
		.control-dock .bet-stepper,
		.control-dock .bet-stepper button,
		.control-dock .bet-input-shell {
			height: 40px;
			min-height: 40px;
		}
		.control-dock .bet-input {
			font-size: 0.85rem;
		}
		.control-dock .fly-button {
			min-height: 100px;
			border-radius: 12px;
			gap: 6px;
		}
		.control-dock .fly-button.launch-ready {
			font-size: 2rem;
		}
		.control-dock .fly-button small {
			font-size: 0.85rem;
			padding: 5px 12px;
		}
		.control-dock .dock-customize {
			min-height: 40px;
			padding: 6px 10px;
			font-size: 0.65rem;
		}
		.control-dock .dock-bonus {
			width: 100%;
			min-height: 40px;
			display: flex;
			align-items: center;
			gap: 7px;
			padding: 6px 10px;
			border-radius: 9px;
			text-align: left;
			font-size: 0.6rem;
		}
		.dock-bonus span {
			margin: 0;
			font-size: 0.55rem;
		}
		.bonus-gift,
		.bonus-arrow {
			display: block;
			width: 18px;
			height: 18px;
			fill: none;
			stroke: currentColor;
			stroke-width: 1.6;
		}
		.bonus-arrow {
			margin-left: auto;
			width: 14px;
		}
		.bet-panel-footer .risk-note:not(.bet-error) {
			display: none;
		}
		.bet-panel-footer:not(.has-validation):has(> span:last-child:empty) {
			display: none;
		}
		.bet-panel-footer {
			font-size: 0.55rem;
		}
	}
	@media (min-width: 701px) {
		.game-layout {
			flex: 1 0 auto;
			grid-template-rows: minmax(280px, 1fr) auto;
		}
		.world {
			height: auto;
		}
	}
	.world {
		--glass-background: rgba(9, 18, 26, 0.64);
		--glass-border: rgba(178, 193, 205, 0.3);
		--glass-text: #cdd4db;
	}
	.world .header-balance,
	.world .top-icons,
	.world .event-callout {
		background: var(--glass-background);
		border-color: var(--glass-border);
		color: var(--glass-text);
		backdrop-filter: blur(8px);
	}
	.world .event-callout {
		color: var(--glass-text);
	}
	.world .event-callout {
		border-radius: 16px;
		top: 154px;
		left: auto;
		right: 16px;
		max-width: min(340px, calc(100% - 160px));
		transform: none;
	}
	@media (max-width: 700px) {
		.world .event-callout {
			border-radius: 12px;
			top: 100px;
			right: 12px;
			max-width: calc(100% - 132px);
			padding: 5px 8px;
			font-size: 0.55rem;
			letter-spacing: 0.06em;
		}
	}

	/* Permanent flight HUD: status, multiplier, and visual progress only. */
	.flight-hud {
		position: absolute;
		z-index: 80;
		top: 100px;
		left: 16px;
		right: 16px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		pointer-events: none;
	}
	.round-status,
	.multiplier-readout {
		background: var(--glass-background);
		backdrop-filter: blur(8px);
		border-radius: 12px;
		color: var(--glass-text);
		white-space: nowrap;
	}
	.round-status {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 11px;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	.round-status::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}
	.round-status.danger {
		color: #ff9a6a;
	}
	.multiplier-readout {
		padding: 6px 12px;
	}
	.multiplier-readout strong {
		display: block;
		min-width: 8ch;
		text-align: right;
		font-size: clamp(1.35rem, 2.4vw, 1.9rem);
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
	}
	.flight-progress {
		position: absolute;
		z-index: 10;
		bottom: 22px;
		left: 50%;
		width: min(340px, 60%);
		height: 3px;
		transform: translateX(-50%);
		border-radius: 999px;
		background: #c6ab694d;
		pointer-events: none;
	}
	.flight-progress i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: #efc56e;
		transition: width 0.3s ease;
	}
	.progress-marker {
		position: absolute;
		top: 50%;
		left: 0;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffe7aa;
		transform: translate(-50%, -50%);
	}
	.flight-progress b {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: #ffe7aa;
		transition: left 0.3s ease;
	}
	@media (max-width: 700px) {
		.flight-hud {
			top: 62px;
			left: 12px;
			right: 12px;
			gap: 8px;
		}
		.round-status {
			padding: 6px 9px;
			font-size: 0.55rem;
		}
		.multiplier-readout {
			padding: 4px 10px;
		}
		.multiplier-readout strong {
			font-size: 1.3rem;
		}
		.flight-progress {
			bottom: 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.flight-progress i,
		.flight-progress b {
			transition: none;
		}
	}

	/* Four-bird gameplay has no creature-selection column. */
	.control-dock {
		grid-template-columns: minmax(240px, 1.2fr) minmax(220px, 1fr) 112px minmax(160px, 0.8fr);
		grid-template-areas: 'risk bet customize action' 'bonus details details details';
	}
	.bet-control {
		align-self: center;
	}
	@media (min-width: 701px) and (max-width: 1000px) {
		.control-dock {
			grid-template-columns: minmax(240px, 1fr) 112px minmax(160px, 1fr);
			grid-template-areas: 'risk risk risk' 'bet customize action' 'bonus details details';
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (max-width: 700px) {
		.control-dock {
			grid-template-columns: 1fr 1fr;
			grid-template-areas: 'risk risk' 'bet action' 'customize customize' 'bonus bonus' 'details details';
		}
	}
</style>
