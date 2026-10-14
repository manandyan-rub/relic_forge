<script lang="ts">
	import type { ActiveBird } from '../flock/types';
	let { bird }: { bird: ActiveBird } = $props();
	const ratio = $derived(bird.health / bird.maxHealth);
</script>

<div
	class="bird-health"
	class:hit={bird.hitFlash > 0}
	class:low={ratio <= 0.5}
	style={`transform:translate3d(${bird.body.position.x}px,${bird.body.position.y}px,0) translate(-50%,-48px);`}
	aria-hidden="true"
>
	<span>{bird.health}/{bird.maxHealth} HP</span>
	<div class="track"><i style={`transform:scaleX(${ratio});`}></i></div>
</div>

<style>
	.bird-health {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 21;
		width: clamp(60px, 5vw, 72px);
		pointer-events: none;
		text-align: center;
		color: #fff0ce;
		font:
			700 10px/1.25 system-ui,
			sans-serif;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		text-shadow: 0 1px 3px #000;
	}
	.track {
		margin-top: 2px;
		padding: 2px;
		height: 8px;
		border-radius: 4px;
		background: #102d32e6;
	}
	span {
		display: inline-block;
		padding: 1px 4px;
		border-radius: 4px;
		background: #09151ecc;
	}
	i {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: #abc882;
		transform-origin: left;
	}
	.low i {
		background: #eac577;
	}
	.hit {
		color: #fff;
	}
	.hit i {
		background: #ee6650;
	}
	@media (max-width: 700px) {
		.bird-health {
			margin-top: 16px;
			font-size: 9px;
		}
	}
</style>
