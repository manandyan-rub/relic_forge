<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		LANGUAGE_NAMES,
		SUPPORTED_LANGUAGES,
		changeLanguage,
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
		applyHunterImpact,
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
	let hunterImpactCount = 0;
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
	const activeHunter = $derived(currentRound?.hunter ?? selectedHunter);
	const currentStage = $derived(getFlightStage(currentStageId));
	const resultWinTier = $derived(
		getWinTier(
			currentRound ? currentRound.finalWin / (currentRound.entryCost ?? currentRound.bet) : 0,
		),
	);
	// Route atmosphere is cosmetic; it never changes the stored result or payout.
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
		hunterImpactCount = 0;
		hunterAttack =
			event.type === 'elimination' && event.reason === 'hunter'
				? planHunterAttack(currentRound?.risk ?? selectedRisk)
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
				if (frame.impacts > hunterImpactCount) {
					hunterImpactCount = frame.impacts;
					activeBirds = applyHunterImpact(activeBirds, event.bird);
				}
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
				<div
					class="header-balance"
					title={wallet.live ? formatLocalAmount(wallet.amount / 1e6) : 'Demo mode'}
				>
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
					><span>Lucky <br />Flight</span><span
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
					<div class="flock-hud-group" class:champion={championActive}>
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
			{#if !championActive && (!currentRound || currentRound.flock)}
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
			{#if !betInputIsValid || replayMode}<div
					class="bet-panel-footer"
					class:has-validation={!betInputIsValid}
				>
					{#if !betInputIsValid}
						<span class="risk-note bet-error" id="bet-validation" role="alert"
							><i aria-hidden="true"></i>{betValidationMessage}</span
						>
					{/if}
					{#if replayMode}<span>Replay — no bet is placed</span>{/if}
				</div>{/if}
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
