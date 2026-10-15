<script lang="ts">
	import type { PickupType } from '../types';
	import { PICKUP_LABELS } from '../presentation';
	import { PICKUP_ARTWORK } from '../pickupArtwork';

	type Props = {
		pickupType: PickupType;
		fromMultiplier: number;
		toMultiplier: number;
	};

	let { pickupType, fromMultiplier, toMultiplier }: Props = $props();
</script>

<div class={`collectible-event ${pickupType}`}>
	<img
		class="pickup-object"
		src={PICKUP_ARTWORK[pickupType]}
		alt=""
		width="256"
		height="256"
		draggable="false"
	/>
	<div class="pickup-copy">
		<strong>{PICKUP_LABELS[pickupType]}</strong>
		<span>x{fromMultiplier.toFixed(2)} → x{toMultiplier.toFixed(2)}</span>
	</div>
</div>

<style>
	.collectible-event {
		position: absolute;
		z-index: 11;
		top: 43%;
		left: 68%;
		display: grid;
		place-items: center;
		color: #c6d6cb;
		text-align: center;
		pointer-events: none;
		animation: pickup-approach calc(0.62s / var(--playback-speed, 1)) ease-in forwards;
	}
	.pickup-object {
		position: relative;
		display: block;
		width: clamp(64px, 8vw, 96px);
		height: auto;
		aspect-ratio: 1;
		object-fit: contain;
		filter: none;
	}
	.pickup-copy {
		position: absolute;
		top: calc(100% + 12px);
		left: 50%;
		width: max-content;
		max-width: 230px;
		padding: 7px 11px;
		border: 1px solid #abc2be66;
		border-radius: 6px;
		background: #122a2de8;
		transform: translateX(-50%);
	}
	.pickup-copy strong,
	.pickup-copy span {
		display: block;
	}
	.pickup-copy strong {
		color: #e9efea;
		font: 700 0.66rem/1.1 var(--font-ui);
		letter-spacing: 0.08em;
	}
	.pickup-copy span {
		margin-top: 5px;
		font: 700 0.75rem/1 var(--font-ui);
	}
	.amberCrystal {
		color: #d7a366;
	}
	.greenCrystal {
		color: #87b59c;
	}
	.goldenFeather {
		color: #d7c285;
	}
	.skyCrystal {
		color: #9fc4d5;
	}
	@keyframes pickup-approach {
		0% {
			opacity: 0;
			transform: translate(30px, -12px) scale(0.45);
		}
		42% {
			opacity: 1;
			transform: translate(0, 0) scale(1);
		}
		100% {
			opacity: 0.25;
			transform: translate(-43vw, 2vh) scale(0.3);
		}
	}
	@media (max-width: 620px) {
		.collectible-event {
			left: 72%;
		}
		.pickup-copy {
			max-width: 180px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.collectible-event {
			animation: none;
		}
	}
</style>
