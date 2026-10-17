<script lang="ts">
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
	} = $props();

	let phase = $state<'idle' | 'rolling' | 'landing'>('idle');
	let rollingBoard = $state<SymbolId[][]>(board.map((column) => [...column]));
	let landingRows = $state<SymbolId[][]>([]);
	let landingOffsets = $state<string[]>([]);
	let landingTimes = $state<number[]>([]);
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
			const begins = performance.now() + reel * (turbo ? 8 : 28);
			const accelerate = turbo ? 70 : 190;
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
		const destinations: number[] = [];
		const rows: SymbolId[][] = [];
		const offsets: string[] = [];
		const times: number[] = [];
		for (let reel = 0; reel < next.length; reel++) {
			const node = tracks.get(reel);
			const column = rollingBoard[reel];
			const height = node?.parentElement?.getBoundingClientRect().height ?? 0;
			if (!node || !column?.length || !Number.isFinite(height) || height <= 0) {
				rows.push([...next[reel]]);
				offsets.push('translate3d(0,0,0)');
				times.push(0);
				destinations.push(0);
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
			offsets.push(`translate3d(0,${-remainder}px,0)`);
			destinations.push(-(column.length + 1) * cell);
			times.push(turbo ? 120 + reel * 12 : 730 + reel * 34);
		}
		landingRows = rows;
		landingOffsets = offsets;
		landingTimes = times;
		phase = 'landing';
		await tick();
		if (generation !== currentGeneration) return;
		const finished: Promise<unknown>[] = [];
		for (let reel = 0; reel < next.length; reel++) {
			const node = tracks.get(reel);
			if (!node || !times[reel]) continue;
			const animation = node.animate(
				[{ transform: offsets[reel] }, { transform: `translate3d(0,${destinations[reel]}px,0)` }],
				{ duration: times[reel], easing: 'cubic-bezier(.333333,.5,.666667,1)', fill: 'forwards' },
			);
			landings.add(animation);
			finished.push(
				animation.finished.catch(() => undefined).finally(() => landings.delete(animation)),
			);
		}
		await Promise.all(finished);
		if (generation === currentGeneration) phase = 'idle';
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
				phase = 'rolling';
			} else if (!active && wasSpinning) settlement = land(next);
			wasSpinning = active;
		});
	});
	onDestroy(cancelMotion);
</script>

<div
	class="reel-cabinet"
	class:reels-moving={spinning || phase !== 'idle'}
	aria-label="Five reels, five rows, twenty paylines"
>
	<div class="cabinet-top">
		<span><UiIcon name="sparkle" size={17} /></span><span
			>{world === 'BLOOM' ? 'THE ENCHANTED GARDEN' : 'THE WITHERED GARDEN'}</span
		><span><UiIcon name="sparkle" size={17} /></span>
	</div>
	<div class="reel-window">
		{#each board as column, r (r)}<div
				class="reel-column"
				class:locked={sticky && wilds.some((w) => w.reel === r)}
				class:reel-in-motion={phase !== 'idle' && !(sticky && wilds.some((w) => w.reel === r))}
				style:--reel={r}
			>
				{#each column as symbol, row (row)}<div
						class="reel-cell"
						class:winning={highlights.includes(`${r}:${row}`)}
					>
						<ReelSymbol {symbol} {world} />
					</div>{/each}
				{#if phase !== 'idle' && !(sticky && wilds.some((w) => w.reel === r))}
					{@const symbols =
						phase === 'landing'
							? landingRows[r]
							: [...rollingBoard[r], ...rollingBoard[r], ...rollingBoard[r]]}
					<div class="reel-spin-viewport" aria-hidden="true">
						<div
							class="reel-spin-track"
							class:reel-landing-track={phase === 'landing'}
							style:block-size={`${(symbols.length / column.length) * 100}%`}
							style:grid-template-rows={`repeat(${symbols.length},minmax(0,1fr))`}
							style:transform={phase === 'landing' ? landingOffsets[r] : undefined}
							style:--settle-duration={`${landingTimes[r] ?? 730}ms`}
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
		<span>20 FIXED LINES</span><span><UiIcon name="flower" size={17} /></span><span
			>5,000× MAX WIN</span
		>
	</div>
</div>
