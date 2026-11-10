<script lang="ts">
 let { win, message, big, warn = false }: { win: string; message: string; big: boolean; warn?: boolean } = $props();
</script>
<div class="win-presentation" class:big class:warn aria-live="polite"><small role={warn ? 'alert' : undefined}>{message}</small><strong>{win}</strong></div>
