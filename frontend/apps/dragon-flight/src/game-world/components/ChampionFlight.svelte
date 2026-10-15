<script lang="ts">
	let { open }: { open: boolean } = $props();
</script>

{#if open}<div class="champion-announcement" role="status">
		<span>4/4 SURVIVED · ALL BIRDS HOME</span><strong>CHAMPION FLIGHT</strong><small
			>Archaeopteryx carries the flock onward</small
		>
	</div>{/if}

<style>
	.champion-announcement {
		position: absolute;
		z-index: 65;
		left: 50%;
		top: 40%;
		transform: translate(-50%, -50%);
		width: min(420px, 85%);
		box-sizing: border-box;
		display: grid;
		gap: 10px;
		padding: 20px;
		text-align: center;
		border-radius: 16px;
		border: 1px solid #d0aa60;
		background: var(--glass-background);
		backdrop-filter: blur(8px);
		color: #f4cd78;
		animation: champion-enter calc(0.28s / var(--playback-speed, 1)) ease-out;
	}
	@keyframes champion-enter {
		from {
			opacity: 0;
			transform: translate(-50%, -45%) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
	span,
	small {
		font-size: 0.65rem;
		letter-spacing: 0.05em;
	}
	strong {
		font-family: var(--font-display);
		font-size: clamp(1.2rem, 3vw, 1.8rem);
	}
</style>
