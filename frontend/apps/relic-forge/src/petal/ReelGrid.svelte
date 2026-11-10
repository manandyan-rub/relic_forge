<script lang="ts">
 import { tr } from './i18n';
	import { onDestroy, tick, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import UiIcon from './UiIcon.svelte';
	import type { SymbolId, World, Wild, LineWin } from './types';
	import WinningPayline from './WinningPayline.svelte';
	import ReelSymbol from './ReelSymbol.svelte';
	import ExpandingWild from './ExpandingWild.svelte';
	let {
		board,
		world,
		spinning,
		wilds,
		sticky,
		highlights,
		line,
		reduced,
		turbo = false,
		quick = false,
		winCells = [],
		onreelstop,
		onanticipate,
	}: {
		board: SymbolId[][];
		world: World;
		spinning: boolean;
		wilds: Wild[];
		sticky: boolean;
		highlights: string[];
		line?: LineWin;
		reduced: boolean;
		turbo?: boolean;
		quick?: boolean;
		winCells?: string[];
		onreelstop?: (reel: number, column: SymbolId[]) => void;
		onanticipate?: () => void;
	} = $props();
	let anticipating = $state<number[]>([]);
	let justLanded = $state(false);
	let landedTimer: ReturnType<typeof setTimeout> | undefined;
	let stopTimers: ReturnType<typeof setTimeout>[] = [];

	let phase = $state<'idle' | 'rolling' | 'landing'>('idle');
	let rollingBoard = $state<SymbolId[][]>(board.map((column) => [...column]));
	let landingRows = $state<SymbolId[][]>([]);
	let landingOffsets = $state<string[]>([]);
	let landingTimes = $state<number[]>([]);
	let landingEasings = $state<string[]>([]);
	let motionTurbo = $state(false);
	const tracks = new SvelteMap<number, HTMLElement>();
	const starts = new SvelteMap<number, () => void>();
	const landings = new SvelteSet<Animation>();
	let wasSpinning = false;
	let generation = 0;
	let settlement: Promise<void> = Promise.resolve();

	function cancelMotion() {
		generation++;
		for (const cancel of starts.values()) cancel();
		starts.clear();
		for (const animation of landings) animation.cancel();
		landings.clear();
		for (const timer of stopTimers) clearTimeout(timer);
		stopTimers = [];
		anticipating = [];
	}

	/** Slam-stop: finish every landing reel immediately (same authoritative board). */
	export function hurry() {
		for (const animation of landings) animation.finish();
	}

	// Begin at the resting symbols, then gently accelerate each reel into the loop.
	function reelMotion(node: HTMLElement, reel: number) {
		tracks.set(reel, node);
		const animation = node.getAnimations()[0];
		let frame = 0;
		let cancelled = false;
		if (animation && !reduced) {
			animation.pause();
			animation.currentTime = 0;
			const begins = performance.now() + reel * (motionTurbo ? 4 : 36);
			const accelerate = motionTurbo ? 45 : 140;
			const advance = (now: number) => {
				if (cancelled) return;
				if (now < begins) {
					frame = requestAnimationFrame(advance);
					return;
				}
				const progress = Math.min(1, (now - begins) / accelerate);
				animation.playbackRate = Math.max(0.035, progress * progress * (3 - 2 * progress));
				if (animation.playState === 'paused') animation.play();
				if (progress < 1) frame = requestAnimationFrame(advance);
			};
			frame = requestAnimationFrame(advance);
		}
		const cancel = () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
		starts.set(reel, cancel);
		return {
			destroy() {
				cancel();
				if (tracks.get(reel) === node) tracks.delete(reel);
				if (starts.get(reel) === cancel) starts.delete(reel);
			},
		};
	}

	async function land(next: SymbolId[][]) {
		for (const cancel of starts.values()) cancel();
		starts.clear();
		if (reduced || phase !== 'rolling') {
			phase = 'idle';
			return;
		}
		const currentGeneration = generation;
		const fast = motionTurbo || quick;
		// Two Scatters already showing: slow the remaining reels so the third can be anticipated.
		const scattersBefore = next.map((_, reel) => next.slice(0, reel).flat().filter((s) => s === 'scatter').length);
		const slowReels = fast ? [] : next.map((_, reel) => reel).filter((reel) => scattersBefore[reel] >= 2);
		let extra = 0;
		const rollingSpeeds = new SvelteMap<number, { rate: number; period: number }>();
		// Freeze every strip before measuring, so rebuilding the landing rows
		// cannot consume another rolling frame between capture and presentation.
		for (const [reel, node] of tracks) {
			const animation = node.getAnimations()[0];
			const duration = animation?.effect?.getTiming().duration;
			rollingSpeeds.set(reel, {
				rate: animation?.playState === 'running' ? animation.playbackRate : 0,
				period: typeof duration === 'number' && duration > 0 ? duration : motionTurbo ? 150 : 300,
			});
			animation?.pause();
		}
		const destinations: number[] = [];
		const rows: SymbolId[][] = [];
		const offsets: string[] = [];
		const times: number[] = [];
		const easings: string[] = [];
		for (let reel = 0; reel < next.length; reel++) {
			const node = tracks.get(reel);
			const column = rollingBoard[reel];
			// Layout pixels, not on-screen pixels: the whole stage is CSS-scaled to fit the window,
			// and the strip's transform is in unscaled layout pixels.
			const height = node?.parentElement?.clientHeight ?? 0;
			if (!node || !column?.length || !Number.isFinite(height) || height <= 0) {
				rows.push([...next[reel]]);
				offsets.push('translate3d(0,0,0)');
				times.push(0);
				destinations.push(0);
				easings.push('linear');
				continue;
			}
			const cell = height / column.length;
			const transform = getComputedStyle(node).transform;
			const position = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
			const travelled = ((-position % height) + height) % height;
			const first = Math.floor(travelled / cell);
			const remainder = travelled - first * cell;
			// Keep every currently visible cell, including the partial cell at the edge.
			// The following five cells are the authoritative outcome arriving on the reel.
			const visible = Array.from(
				{ length: column.length + 1 },
				(_, row) => column[(first + row) % column.length],
			);
			rows.push([...visible, ...next[reel]]);
			offsets.push(tr(`translate3d(0,${-remainder}px,0)`));
			destinations.push(-(column.length + 1) * cell);
			if (slowReels.includes(reel)) extra += 720;
			const duration = (fast ? 190 + reel * 26 : 360 + reel * 95) + extra;
			const speed = rollingSpeeds.get(reel)!;
			const overshoot = fast ? cell * 0.02 : cell * 0.035;
			const distance = (column.length + 1) * cell - remainder + overshoot;
			const velocity = height * speed.rate / speed.period;
			// Linear x controls make the first derivative exactly 3*y1.
			// Match the incoming pixel velocity and reach zero velocity at the end.
			const initialSlope = Math.max(0, Math.min(1, velocity * duration * 0.84 / (3 * distance)));
			times.push(duration);
			easings.push(tr(`cubic-bezier(.3333333333,${initialSlope},.6666666667,1)`));
		}
		const overshoots = rows.map((_, reel) => {
			const height = tracks.get(reel)?.parentElement?.clientHeight ?? 0;
			return (height / 5) * (fast ? 0.02 : 0.035);
		});
		landingRows = rows;
		landingOffsets = offsets;
		landingTimes = times;
		landingEasings = easings;
		phase = 'landing';
		await tick();
		if (generation !== currentGeneration) return;
		const finished: Promise<unknown>[] = [];
		for (let reel = 0; reel < next.length; reel++) {
			const node = tracks.get(reel);
			if (!node || !times[reel]) continue;
			// Arrive slightly past the stop, then settle back: the classic reel "thunk".
			const animation = node.animate(
				[
					{ transform: offsets[reel], easing: landingEasings[reel] },
					{ transform: `translate3d(0,${destinations[reel] - overshoots[reel]}px,0)`, offset: 0.84, easing: 'cubic-bezier(.3,0,.4,1)' },
					{ transform: `translate3d(0,${destinations[reel]}px,0)` },
				],
				{ duration: times[reel], fill: 'forwards' },
			);
			landings.add(animation);
			const column = next[reel];
			let stopped = false;
			const stop = () => {
				if (stopped || generation !== currentGeneration) return;
				stopped = true;
				anticipating = anticipating.filter((r) => r !== reel);
				onreelstop?.(reel, column);
				const following = slowReels.filter((r) => r > reel);
				if (following.length && reel === Math.min(...following) - 1) {
					anticipating = following;
					onanticipate?.();
				}
			};
			stopTimers.push(setTimeout(stop, times[reel] * 0.84));
			void animation.finished.then(stop, () => undefined);
			finished.push(
				animation.finished.catch(() => undefined).finally(() => landings.delete(animation)),
			);
		}
		await Promise.all(finished);
		if (generation === currentGeneration) {
			phase = 'idle';
			anticipating = [];
			justLanded = true;
			clearTimeout(landedTimer);
			landedTimer = setTimeout(() => (justLanded = false), 650);
		}
	}

	// The event presenter waits for the actual landing before highlighting wins.
	export async function settle() {
		await tick();
		await settlement;
	}

	$effect(() => {
		const active = spinning;
		const next = board;
		const reduce = reduced;
		untrack(() => {
			if (reduce) {
				cancelMotion();
				phase = 'idle';
			} else if (active && (!wasSpinning || phase === 'idle')) {
				cancelMotion();
				rollingBoard = next.map((column) => [...column]);
				motionTurbo = turbo;
				phase = 'rolling';
			} else if (!active && wasSpinning) settlement = land(next);
			wasSpinning = active;
		});
	});
	onDestroy(() => { cancelMotion(); clearTimeout(landedTimer); });
</script>

<div
	class="reel-cabinet"
 dir="ltr"
	class:reels-moving={spinning || phase !== 'idle'}
	class:just-landed={justLanded}
	class:showing-wins={winCells.length > 0 && !spinning && phase === 'idle'}
	aria-label={tr("Five reels, five rows, twenty paylines")}
>
	<div class="cabinet-top">
		<span><UiIcon name="sparkle" size={17} /></span><span
			>{world === 'BLOOM' ? tr('THE ENCHANTED GARDEN') : tr('THE WITHERED GARDEN')}</span
		><span><UiIcon name="sparkle" size={17} /></span>
	</div>
	<div class="reel-window">
		{#each board as column, r (r)}<div
				class="reel-column"
				class:locked={sticky && wilds.some((w) => w.reel === r)}
				class:reel-in-motion={phase !== 'idle' && !(sticky && wilds.some((w) => w.reel === r))}
				class:anticipating={anticipating.includes(r)}
				style:--reel={r}
			>
				{#each column as symbol, row (row)}<div
						class="reel-cell"
						class:winning={highlights.includes(`${r}:${row}`)}
						class:win-any={winCells.includes(`${r}:${row}`)}
						style:--row={row}
					>
						<ReelSymbol {symbol} {world} />
					</div>{/each}
				{#if phase !== 'idle' && !(sticky && wilds.some((w) => w.reel === r))}
					{@const symbols =
						phase === 'landing'
							? landingRows[r]
							: [...rollingBoard[r], ...rollingBoard[r]]}
					<div class="reel-spin-viewport" aria-hidden="true">
						<div
							class="reel-spin-track"
							class:reel-landing-track={phase === 'landing'}
							style:block-size={`${(symbols.length / column.length) * 100}%`}
							style:grid-template-rows={tr(`repeat(${symbols.length},minmax(0,1fr))`)}
							style:transform={phase === 'landing' ? landingOffsets[r] : undefined}
							style:--settle-duration={tr(`${landingTimes[r] ?? 730}ms`)}
							style:--reel-cycle-duration={motionTurbo ? '150ms' : '300ms'}
							use:reelMotion={r}
						>
							{#each symbols as symbol, row (row)}<div class="reel-spin-cell">
									<ReelSymbol {symbol} {world} />
								</div>{/each}
						</div>
					</div>
				{/if}
			</div>{/each}
		<div class="wild-layer">
			{#each wilds as wild (wild.reel)}<ExpandingWild {wild} {world} {sticky} />{/each}
		</div>
		{#if !spinning && phase === 'idle' && line}{#key line}<WinningPayline
					{line}
					{world}
					{reduced}
				/>{/key}{/if}
	</div>
	<div class="cabinet-bottom">
		<span>{tr("20 FIXED LINES")}</span><span><UiIcon name="flower" size={17} /></span><span
			>{tr("5,000× MAX WIN")}</span
		>
	</div>
</div>
