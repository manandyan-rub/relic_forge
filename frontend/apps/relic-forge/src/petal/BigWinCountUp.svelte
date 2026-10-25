<script lang="ts">
 import { tr, t, locale } from './i18n';
	import { onMount } from 'svelte';
	import type { World } from './types';
	import type { createWinCountAudio } from './winCountAudio';

	let {
		world, amount, multiplier, format, reduced, sound, countAudio, oncontinue,
	}: {
		world: World;
		amount: number;
		multiplier: number;
		format: (amount: number) => string;
		reduced: boolean;
		sound: boolean;
		countAudio?: ReturnType<typeof createWinCountAudio>;
		oncontinue: (stopAutoplay?: boolean) => void;
	} = $props();

	const id = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let button = $state<HTMLButtonElement>();
	let displayed = $state(0);
	let counting = $state(true);
	let mounted = false;
	let dismissed = false;
	let frame = 0;
	let hold: ReturnType<typeof setTimeout> | undefined;
	const target = $derived(format(amount));
	const ratio = $derived(`${new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(multiplier)}×`);

	function complete() {
		if (dismissed || !counting) return;
		cancelAnimationFrame(frame);
		displayed = amount;
		counting = false;
		countAudio?.stop();
		if (sound && !document.hidden) countAudio?.finish();
		hold = setTimeout(() => continueOnce(), reduced ? 1000 : 1400);
	}

	function continueOnce(stopAutoplay = false) {
		if (dismissed) return;
		dismissed = true;
		cancelAnimationFrame(frame);
		clearTimeout(hold);
		countAudio?.stop();
		oncontinue(stopAutoplay);
	}

	function advance() { if (counting) complete(); else continueOnce(); }
	function click(event: MouseEvent) { event.stopPropagation(); advance(); }
	function keydown(event: KeyboardEvent) {
		event.stopPropagation();
		if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'Escape') return;
		event.preventDefault();
		if (event.repeat) return;
		if (event.key === 'Escape') continueOnce(true);
		else advance();
	}
	function cancel(event: Event) { event.preventDefault(); event.stopPropagation(); continueOnce(true); }
	function visibility() { if (document.hidden) countAudio?.stop(); }

	$effect(() => { countAudio?.setMuted(!sound); });
	$effect(() => { if (reduced && mounted) complete(); });

	onMount(() => {
		mounted = true;
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.documentElement.style.overflow;
		const previousGutter = document.documentElement.style.scrollbarGutter;
		document.documentElement.style.overflow = 'hidden';
		document.documentElement.style.scrollbarGutter = 'auto';
		dialog?.showModal();
		dialog?.addEventListener('keydown', keydown);
		document.addEventListener('visibilitychange', visibility);
		button?.focus({ preventScroll: true });
		countAudio?.setMuted(!sound);
		if (reduced) complete();
		else {
			if (sound && !document.hidden) countAudio?.start();
			const duration = multiplier >= 100 ? 3600 : multiplier >= 50 ? 2940 : 2460;
			const start = performance.now();
			const step = (now: number) => {
				if (dismissed || !counting) return;
				const progress = Math.min(1, Math.max(0, (now - start) / duration));
				displayed = amount * (1 - (1 - progress) ** 3);
				if (progress === 1) complete();
				else frame = requestAnimationFrame(step);
			};
			frame = requestAnimationFrame(step);
		}
		return () => {
			mounted = false;
			dismissed = true;
			cancelAnimationFrame(frame);
			clearTimeout(hold);
			countAudio?.stop();
			dialog?.removeEventListener('keydown', keydown);
			document.removeEventListener('visibilitychange', visibility);
			if (dialog?.open) dialog.close();
			document.documentElement.style.overflow = previousOverflow;
			document.documentElement.style.scrollbarGutter = previousGutter;
			if (previous?.isConnected && !previous.matches(':disabled, [aria-disabled="true"]') && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
		};
	});
</script>

<dialog bind:this={dialog} class="big-win-count" class:reduced data-world={world} data-counting={counting} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-total`} oncancel={cancel}>
	<div class="count-content">
		<p class="count-kicker">{tr("THE LAST PETAL")}</p>
		<h2 id={`${id}-heading`}>{tr("BIG WIN")}</h2>
		<div class="count-amount" dir="ltr" style={`--amount-characters:${Math.max(6, target.length)}`} aria-hidden="true">
			<strong class="count-target">{target}</strong>
			<strong class="count-value">{format(displayed)}</strong>
		</div>
		<p id={`${id}-total`} class="visually-hidden">{t('youWon')} {target} · {ratio} {t('bet')}.</p>
		<span class="count-multiplier" dir="ltr">{ratio}</span>
		<button bind:this={button} class="count-continue" type="button" onclick={click}>{counting ? tr('Skip count') : tr('Continue')}</button>
	</div>
</dialog>

<style>
	.big-win-count {
		--count-gold: #efd391;
		--count-paper: #fff2d2;
		--count-ink: #202719;
		position: fixed;
		inset: 0;
		display: none;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-width: none;
		max-height: none;
		box-sizing: border-box;
		margin: 0;
		padding: max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px));
		border: 0;
		overflow: auto;
		overscroll-behavior: contain;
		background: radial-gradient(ellipse at 50% 40%, #3c4829 0%, #192619 55%, #10190f 100%);
		color: var(--count-paper);
		font-family: var(--font-ui, sans-serif);
		text-align: center;
	}
	.big-win-count[open] { display: grid; place-items: center; }
	.big-win-count[data-world='BLIGHT'] {
		--count-gold: #e6b08b;
		--count-paper: #f6e2ce;
		--count-ink: #2b1a14;
		background: radial-gradient(ellipse at 50% 40%, #4b3025 0%, #271b16 55%, #150e0c 100%);
	}
	.big-win-count::backdrop { background: #10150f; }
	.count-content { display: grid; justify-items: center; width: 100%; min-width: 0; }
	.count-kicker { margin: 0 0 24px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.24em; color: var(--count-gold); }
	h2 { margin: 0 0 28px; font-size: clamp(1.5rem, 4vw, 3rem); font-weight: 700; letter-spacing: 0.16em; }
	.count-amount {
		display: grid;
		max-width: 100%;
		color: var(--count-gold);
		font-size: min(clamp(2.8rem, 14vw, 11rem), calc((100vw - 48px) / (var(--amount-characters) * 0.72)));
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1.15;
		white-space: nowrap;
	}
	.count-amount strong { grid-area: 1 / 1; text-align: right; }
	.count-target { visibility: hidden; }
	.count-multiplier { margin-top: 28px; padding: 10px 24px; border: 1px solid #d9c08d40; border-radius: 999px; color: var(--count-paper); font-size: clamp(1rem, 3vw, 1.5rem); font-weight: 600; font-variant-numeric: tabular-nums; }
	.count-continue { margin-top: 44px; min-width: 160px; padding: 14px 28px; border: 1px solid var(--count-gold); border-radius: 8px; background: var(--count-gold); color: var(--count-ink); font: 700 0.95rem / 1.2 var(--font-ui, sans-serif); cursor: pointer; }
	.count-continue:hover { filter: brightness(1.08); }
	.count-continue:focus-visible { outline: 3px solid var(--count-paper); outline-offset: 5px; }
	.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
	@media (max-height: 500px) {
		.count-kicker { margin-bottom: 12px; }
		h2 { margin-bottom: 12px; font-size: 1.3rem; }
		.count-amount { font-size: min(18vh, calc((100vw - 48px) / (var(--amount-characters) * 0.72))); }
		.count-multiplier { margin-top: 12px; }
		.count-continue { margin-top: 18px; }
	}
</style>
