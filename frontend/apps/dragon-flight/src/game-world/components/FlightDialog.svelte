<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		open,
		title,
		onClose,
		children,
	}: { open: boolean; title: string; onClose: () => void; children: Snippet } = $props();
	let dialog = $state<HTMLDialogElement>();
	const id = $props.id();
	$effect(() => {
		if (open && dialog && !dialog.open) dialog.showModal();
		if (!open && dialog?.open) dialog.close();
	});
</script>

<dialog bind:this={dialog} aria-labelledby={id} onclose={onClose}>
	<header>
		<h2 {id}>{title}</h2>
		<button
			type="button"
			aria-label={`Close ${title}`}
			data-audio-panel
			onclick={() => dialog?.close()}
			><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button
		>
	</header>
	<div class="content">{@render children()}</div>
</dialog>

<style>
	dialog {
		width: min(780px, calc(100vw - 24px));
		max-height: 90dvh;
		padding: 0;
		border: 1px solid #64727a;
		border-radius: 18px;
		color: #e1eeea;
		background: #0e1c24;
		box-shadow: 0 24px 90px #0009;
	}
	dialog::backdrop {
		background: #061219b8;
		backdrop-filter: blur(5px);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		position: sticky;
		top: 0;
		z-index: 2;
		background: #0e1c24;
		padding: 16px 20px;
		border-bottom: 1px solid #536c6b;
	}
	h2 {
		margin: 0;
		font: 600 1.3rem/1.2 var(--font-display);
	}
	button {
		display: grid;
		place-items: center;
		padding: 0;
		box-sizing: border-box;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border: 1px solid #698985;
		border-radius: 50%;
		background: #14232c;
		color: #e1eeea;
		font-size: 24px;
		cursor: pointer;
	}
	button svg {
		display: block;
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	button:focus-visible {
		outline: 2px solid #71eac1;
		outline-offset: 3px;
	}
	.content {
		padding: 18px 20px 20px;
	}
	@media (max-width: 480px) {
		header {
			padding: 12px;
		}
		.content {
			padding: 12px;
		}
	}
</style>
