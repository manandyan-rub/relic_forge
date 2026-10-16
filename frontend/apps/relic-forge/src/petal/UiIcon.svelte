<script lang="ts">
 let { name, size=24 }: { name: 'flower'|'sparkle'|'castle'|'spin'|'turbo'|'plus'|'minus'|'help'|'settings'|'close'; size?:number } = $props();
</script>
<svg class="ui-icon" data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
 {#if name==='flower'}
  {#each [0,60,120,180,240,300] as angle (angle)}<ellipse cx="12" cy="6.5" rx="2.8" ry="4.5" transform={`rotate(${angle} 12 12)`}/>{/each}<circle cx="12" cy="12" r="2.4"/>
 {:else if name==='sparkle'}<path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9Z"/>
 {:else if name==='castle'}
  <path d="M5 3 H8 V6 H10 V3 H14 V6 H16 V3 H19 V10 H17 L18 21 H6 L7 10 H5Z M7 10 H17 M6 18 H18 M10 21 V15 H14 V21"/>
 {:else if name==='spin'}
  <path d="M19 8 A8 8 0 1 0 20 15 M19 3 V9 H13"/>
 {:else if name==='turbo'}
  <path d="M14 2 L5 14 H12 L10 22 L19 10 H12Z"/>
 {:else if name==='plus'}<path d="M5 12 H19 M12 5 V19"/>
 {:else if name==='minus'}<path d="M5 12 H19"/>
 {:else if name==='help'}<path d="M8 8 A4 4 0 1 1 14 11.5 Q12 12.5 12 15"/><circle cx="12" cy="19" r=".7" fill="currentColor" stroke="none"/>
 {:else if name==='settings'}<path d="M4 6 H20 M4 12 H20 M4 18 H20"/><circle cx="9" cy="6" r="2" fill="var(--icon-fill,#243223)"/><circle cx="15" cy="12" r="2" fill="var(--icon-fill,#243223)"/><circle cx="9" cy="18" r="2" fill="var(--icon-fill,#243223)"/>
 {:else if name==='close'}<path d="M6 6 L18 18 M18 6 L6 18"/>{/if}
</svg>
