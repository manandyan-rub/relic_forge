<script lang="ts">
	import type { World } from './types';

	let {
		world,
		reduced,
		onready,
		opened = false,
	}: { world: World; reduced: boolean; opened?: boolean; onready?: () => void } = $props();
	const image = $derived(`/art/${world.toLowerCase()}-free-spins-gift.png`);
	let ready = $state(false);
	let failed = $state(false);
	let notified = false;

	function notifyReady() {
		if (notified) return;
		notified = true;
		onready?.();
	}

	function handleLoad() {
		if (failed) return;
		ready = true;
		notifyReady();
	}

	function handleError() {
		failed = true;
		ready = true;
		notifyReady();
	}
</script>

<div class="gift" class:reduced class:ready class:failed class:opened data-world={world} aria-hidden="true">
	<img
		class="gift-base"
		src={image}
		width="1254"
		height="1254"
		alt=""
		draggable="false"
		onload={handleLoad}
		onerror={handleError}
	/>
	<img
		class="gift-lid"
		src={image}
		width="1254"
		height="1254"
		alt=""
		draggable="false"
		onerror={handleError}
	/>
</div>

<style>
	.gift {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		overflow: visible;
		isolation: isolate;
		pointer-events: none;
		user-select: none;
	}

	.gift-base,
	.gift-lid {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.gift-base {
		z-index: 0;
		clip-path: inset(51.65% 0 0);
	}

	.gift-lid {
		z-index: 1;
		clip-path: inset(0 0 52.3%);
		transform-origin: 55% 28%;
		transform: translate(var(--gift-lid-closed-x, 0%), var(--gift-lid-closed-y, 36%));
	}

	.gift[data-world='BLIGHT'] .gift-base {
		clip-path: inset(47.3% 0 1.6%);
	}

	.gift[data-world='BLIGHT'] .gift-lid {
		clip-path: inset(0 0 53.15%);
	}

	.gift:not(.ready) img {
		visibility: hidden;
	}

	.gift.failed img {
		display: none;
	}

	.gift.ready .gift-lid {
		animation: gift-open var(--gift-open-duration, 1400ms) cubic-bezier(0.2, 0.7, 0.2, 1)
			var(--gift-open-delay, 550ms) both;
	}

	@keyframes gift-open {
		0% {
			transform: translate(var(--gift-lid-closed-x, 0%), var(--gift-lid-closed-y, 36%))
				rotate(0deg);
			opacity: 1;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translate(var(--gift-lid-open-x, 55%), var(--gift-lid-open-y, -10%))
				rotate(var(--gift-lid-open-rotation, 18deg));
			opacity: 0;
		}
	}

	.gift.ready.reduced .gift-lid,
	.gift.opened .gift-lid {
		animation: none;
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.gift.ready .gift-lid {
			animation: none;
			opacity: 0;
		}
	}
</style>
