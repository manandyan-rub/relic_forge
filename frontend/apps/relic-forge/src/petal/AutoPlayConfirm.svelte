<script lang="ts">
 import { tr, t } from './i18n';
	import { onMount } from 'svelte';
	let { bet, maximum, confirm, close }: { bet: string; maximum: string; confirm: () => void; close: () => void } = $props();
	let dialog: HTMLDialogElement;
	let cancelButton: HTMLButtonElement;
	let dismissed = false;
	function finish(start = false) { if (dismissed) return; dismissed = true; if (start) confirm(); else close(); }
	function key(event: KeyboardEvent) { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); finish(); } }
	onMount(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.showModal(); cancelButton.focus({ preventScroll: true });
		dialog.addEventListener('keydown', key);
		return () => { dialog.removeEventListener('keydown', key); dialog.close(); if (previous?.isConnected && !previous.matches(':disabled')) previous.focus({ preventScroll: true }); };
	});
</script>

<dialog bind:this={dialog} class="auto-confirm" aria-labelledby="autoplay-title" oncancel={event => { event.preventDefault(); finish(); }}>
	<small>{tr("THE LAST PETAL")}</small>
	<h2 id="autoplay-title">{tr("Start autoplay?")}</h2>
	<p>{t('autoLimit',{bet,maximum})}</p>
	<p>{tr("You can stop autoplay at any time. A spin already in progress will finish.")}</p>
	<div class="actions">
		<button bind:this={cancelButton} type="button" onclick={() => finish()} aria-label={tr("Cancel autoplay")}>{tr("Cancel")}</button>
		<button type="button" onclick={() => finish(true)} aria-label={tr("Confirm 10 autoplay spins")}>{tr("Start 10 spins")}</button>
	</div>
</dialog>

<style>
	.auto-confirm { width: min(460px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 28px; border: 1px solid #b99b61; border-radius: 16px; background: #202b1d; color: #f8e9c8; font-family: var(--font-ui); line-height: 1.6; }
	.auto-confirm::backdrop { background: #090f0ac9; }
	small { color: #dfc184; letter-spacing: 0.15em; }
	h2 { margin: 12px 0; }
	.actions { display: flex; flex-wrap: wrap; justify-content: end; gap: 12px; margin-top: 24px; }
	button { padding: 12px 16px; border: 1px solid #d9bd83; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	button:last-child { background: #e0c68f; color: #202b1d; font-weight: 700; }
	button:focus-visible { outline: 3px solid #fff2d0; outline-offset: 3px; }
</style>
