<script lang="ts">
 import { tr, t } from './i18n';
	import { onMount } from 'svelte';
	import { art } from './config';
	import FreeSpinsGift from './FreeSpinsGift.svelte';
	import type { World } from './types';

	let {
		world,
		count,
		reduced,
		oncontinue,
		onreveal,
	}: { world: World; count: number; reduced: boolean; oncontinue: (stopAutoplay?: boolean) => void; onreveal: () => void } = $props();

	const id = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let startButton = $state<HTMLButtonElement>();
	let dismissed = false;
	let giftReady = $state(false);
	let rewardRevealed = $state(false);
	let revealTimer: ReturnType<typeof setTimeout> | undefined;
	let loadTimer: ReturnType<typeof setTimeout> | undefined;

	function finishReveal() {
		if (rewardRevealed || dismissed) return;
		clearTimeout(revealTimer);
		rewardRevealed = true;
		onreveal();
	}

	function reveal() {
		if (giftReady || dismissed) return;
		clearTimeout(loadTimer);
		giftReady = true;
		if (reduced) finishReveal();
		else revealTimer = setTimeout(finishReveal, 2250);
	}

	function continueOnce(stopAutoplay = false) {
		if (dismissed) return;
		dismissed = true;
		oncontinue(stopAutoplay);
	}

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		continueOnce();
	}

	function handleKeydown(event: KeyboardEvent) {
		event.stopPropagation();
		if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
			event.preventDefault();
			if (!event.repeat) continueOnce(event.key === 'Escape');
		}
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		event.stopPropagation();
		continueOnce(true);
	}

	onMount(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.documentElement.style.overflow;
		const previousGutter = document.documentElement.style.scrollbarGutter;
		document.documentElement.style.overflow = 'hidden';
		document.documentElement.style.scrollbarGutter = 'auto';
		dialog?.showModal();
		dialog?.addEventListener('keydown', handleKeydown);
		startButton?.focus({ preventScroll: true });
		// A stalled decorative image must never hold up the feature.
		if (!giftReady) loadTimer = setTimeout(() => {
			giftReady = true;
			finishReveal();
		}, 2500);
		return () => {
			clearTimeout(loadTimer);
			clearTimeout(revealTimer);
			dialog?.removeEventListener('keydown', handleKeydown);
			if (dialog?.open) dialog.close();
			document.documentElement.style.overflow = previousOverflow;
			document.documentElement.style.scrollbarGutter = previousGutter;
			if (
				previous?.isConnected &&
				!previous.matches(':disabled, [aria-disabled="true"]') &&
				!previous.closest('[inert]')
			) {
				previous.focus({ preventScroll: true });
			}
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="award"
	class:reduced
	data-world={world}
	style={`--award-room: url("${art(world, 'room')}")`}
	aria-labelledby={`${id}-heading`}
	aria-describedby={`${id}-description`}
	oncancel={handleCancel}
>
	<div class="scene" aria-hidden="true"></div>
	<div class="content" class:gift-ready={giftReady}>
		<div class="presentation">
			<div class="presenter">
				<img
					class="presenter-art"
					src={world === 'BLOOM' ? art(world, 'guardian') : './art/blight-gift-presenter.webp'}
					width={world === 'BLOOM' ? 453 : 780}
					height={world === 'BLOOM' ? 650 : 1300}
					alt=""
				/>
				<div class="award-copy">
					<FreeSpinsGift {world} {reduced} opened={rewardRevealed} onready={reveal} />
					<div class="award-reward">
						<div class="reward-motion" class:revealed={rewardRevealed || reduced} onanimationend={finishReveal}>
							<p class="kicker">{tr("YOU WON")}</p>
							<strong class="count" aria-hidden="true">{count}</strong>
							<h2 id={`${id}-heading`}>{tr("FREE SPINS")}</h2>
						</div>
					</div>
				</div>
			</div>
		</div>
		<p id={`${id}-description`} class="visually-hidden">
			{t('freeSpins')}: {count}. {t('startFreeSpins')}.
		</p>
		<button bind:this={startButton} type="button" onclick={handleClick}>{tr("Start free spins")}</button>
	</div>
</dialog>

<style>
	.award {
		--award-accent: #f0d493;
		--award-button: #dfc38a;
		--award-ink: #202317;
		position: fixed;
		inset: 0;
		display: none;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: max(24px, env(safe-area-inset-top, 0px))
			max(24px, env(safe-area-inset-right, 0px))
			max(24px, env(safe-area-inset-bottom, 0px))
			max(24px, env(safe-area-inset-left, 0px));
		overflow: auto;
		overscroll-behavior: contain;
		border: 0;
		box-sizing: border-box;
		background: #0b130c;
		color: #fff4d8;
		font-family: var(--font-ui, sans-serif);
		text-align: center;
		isolation: isolate;
	}

	.award[open] {
		display: grid;
		place-items: center;
	}

	.award[data-world='BLIGHT'] {
		--award-accent: #edc09e;
		--award-button: #c39474;
		--award-ink: #25140f;
		background: #160d0b;
	}

	.award::backdrop {
		background: #090d09;
	}

	.scene {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			linear-gradient(180deg, #09100bd9, #10170dd9 50%, #080d09f2),
			var(--award-room) center / cover no-repeat;
		pointer-events: none;
	}

	.award[data-world='BLIGHT'] .scene {
		background:
			linear-gradient(180deg, #180b08de, #1d100bd9 50%, #100907f2),
			var(--award-room) center / cover no-repeat;
	}

	.content {
		--presentation-ratio: 1.24;
		width: min(100%, calc((100dvh - 130px) * var(--presentation-ratio)), 680px);
		margin: auto;
		container-type: inline-size;
		animation: award-enter 240ms ease-out both;
	}

	.presentation {
		position: relative;
		width: 100%;
		aspect-ratio: var(--presentation-ratio);
	}

	.presenter {
		position: absolute;
		bottom: 0;
		left: 18%;
		height: 60%;
		aspect-ratio: 453 / 650;
	}

	.presenter-art {
		display: block;
		width: 100%;
		height: 100%;
	}

	.award-copy {
		position: absolute;
		left: 90%;
		top: 28%;
		width: clamp(110px, 30cqw, 210px);
		transform: translate(-50%, -96%);
		text-shadow: 0 3px 16px #000c;
	}

	.award-reward {
		position: absolute;
		z-index: 2;
		left: 50%;
		bottom: 55%;
		width: 48cqw;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.reward-motion {
		transform-origin: center bottom;
		animation: reward-emerge 1000ms cubic-bezier(0.2, 0.75, 0.2, 1) 1100ms both;
		animation-play-state: paused;
	}

	.gift-ready .reward-motion {
		animation-play-state: running;
	}

	.reward-motion.revealed {
		animation: none;
	}

	.award[data-world='BLIGHT'] .presenter {
		left: auto;
		right: 20%;
		aspect-ratio: 780 / 1300;
	}

	.award[data-world='BLIGHT'] .award-copy {
		left: -6%;
		top: 46%;
	}

	.kicker {
		margin: 0 0 10px;
		color: var(--award-accent);
		font-size: clamp(10px, 2.1cqw, 14px);
		font-weight: 700;
		letter-spacing: 0.24em;
	}

	.count {
		display: block;
		color: var(--award-accent);
		font-size: clamp(64px, 19cqw, 130px);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 0.88;
		letter-spacing: -0.06em;
		text-shadow: 0 5px 24px #0008;
	}

	h2 {
		margin: 12px 0 0;
		font-size: clamp(14px, 4.2cqw, 28px);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.15em;
		white-space: nowrap;
	}

	button {
		min-width: min(100%, 220px);
		min-height: 52px;
		margin-top: 24px;
		padding: 14px 26px;
		border: 1px solid #fff2c870;
		border-radius: 12px;
		background: var(--award-button);
		color: var(--award-ink);
		font: inherit;
		font-size: 16px;
		font-weight: 700;
		line-height: 1.3;
		cursor: pointer;
	}

	button:focus-visible {
		outline: 3px solid var(--award-accent);
		outline-offset: 5px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.reduced .content,
	.reduced .reward-motion {
		animation: none;
	}

	@keyframes reward-emerge {
		from {
			opacity: 0;
			transform: translateY(100px) scale(0.2);
		}
		25% {
			opacity: 0;
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes award-enter {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 600px) {
		.content {
			--presentation-ratio: 0.95;
		}
		.presenter {
			left: 12%;
			height: 52%;
		}
		.award[data-world='BLIGHT'] .presenter {
			right: 8%;
		}
		.count {
			font-size: clamp(64px, 24cqw, 120px);
		}
		h2 {
			margin-top: 10px;
			font-size: clamp(17px, 5.2cqw, 26px);
		}
	}

	@media (max-height: 500px) {
		.content {
			--presentation-ratio: 1.24;
		}
		.presenter {
			left: 12%;
			height: 52%;
		}
		.award[data-world='BLIGHT'] .presenter {
			right: 12%;
		}
		.count {
			font-size: clamp(48px, 20cqw, 100px);
		}
		.kicker {
			margin-bottom: 6px;
		}
		h2 {
			margin-top: 8px;
			font-size: clamp(13px, 4.2cqw, 22px);
		}
		button {
			min-height: 46px;
			margin-top: 12px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.content,
		.reward-motion {
			animation: none;
		}
	}
</style>
