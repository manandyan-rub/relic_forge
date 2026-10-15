<script lang="ts">
 let { win, message, big }: { win: string; message: string; big: boolean } = $props();
</script>
<div class="win-presentation" class:big aria-live="polite"><small>{message}</small><strong>{win}</strong></div>
