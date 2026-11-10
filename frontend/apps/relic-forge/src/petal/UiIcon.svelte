<script lang="ts">
 type Name = 'flower'|'sparkle'|'castle'|'spin'|'turbo'|'plus'|'minus'|'help'|'settings'|'close'|'chevron'|'stop'|'auto'|'sound'|'mute';
 let { name, size=24 }: { name: Name; size?: number } = $props();
 // Hand-inked icon set: filled shapes with a dark ink outline, drawn to sit with the
 // illustrated symbols (the shared #ink-wobble filter adds the brush edge).
 const ink = 'var(--icon-ink, #24170f)';
</script>
<svg class="ui-icon" data-icon={name} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
 {#if name==='flower'}
  {#each [0,60,120,180,240,300] as angle (angle)}<path d="M12 12 C7.6 9.8 8 4.4 12 2.4 C16 4.4 16.4 9.8 12 12Z" transform={`rotate(${angle} 12 12)`} fill="currentColor" stroke={ink} stroke-width="1"/>{/each}
  <circle cx="12" cy="12" r="2.9" fill="var(--icon-accent, #e8b54a)" stroke={ink} stroke-width="1.1"/>
 {:else if name==='sparkle'}
  <path d="M12 2.2 C12.9 8.4 15.6 11.1 21.8 12 C15.6 12.9 12.9 15.6 12 21.8 C11.1 15.6 8.4 12.9 2.2 12 C8.4 11.1 11.1 8.4 12 2.2Z" fill="currentColor" stroke={ink} stroke-width="1.1"/>
 {:else if name==='castle'}
  <path d="M4.5 21.5 V9.5 H6.2 V6.2 H8.2 V8.4 H10.2 V4.4 L12 2.5 L13.8 4.4 V8.4 H15.8 V6.2 H17.8 V9.5 H19.5 V21.5Z" fill="currentColor" stroke={ink} stroke-width="1.1"/>
  <path d="M10 21.5 V16.6 C10 14 14 14 14 16.6 V21.5Z" fill={ink}/>
 {:else if name==='spin'}
  <path d="M18.8 7.6 A8 8 0 1 0 20 14.6" fill="none" stroke={ink} stroke-width="4.4"/>
  <path d="M18.8 7.6 A8 8 0 1 0 20 14.6" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <path d="M21.3 2.8 L20.7 10.2 L14 7.4Z" fill="currentColor" stroke={ink} stroke-width="1.1"/>
 {:else if name==='auto'}
  <path d="M4.4 11.4 A7.6 7.6 0 0 1 17.6 6.6 M19.6 12.6 A7.6 7.6 0 0 1 6.4 17.4" fill="none" stroke={ink} stroke-width="4"/>
  <path d="M4.4 11.4 A7.6 7.6 0 0 1 17.6 6.6 M19.6 12.6 A7.6 7.6 0 0 1 6.4 17.4" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M19.6 3.2 L19.2 8.6 L14.4 6.4Z M4.4 20.8 L4.8 15.4 L9.6 17.6Z" fill="currentColor" stroke={ink} stroke-width="1"/>
  <path d="M10.2 9 L15 12 L10.2 15Z" fill="currentColor" stroke={ink} stroke-width="1"/>
 {:else if name==='turbo'}
  <path d="M13.8 1.8 L4.4 13.6 H11 L9.4 22.2 L19.6 9.8 H12.8Z" fill="currentColor" stroke={ink} stroke-width="1.2"/>
 {:else if name==='plus'}
  <path d="M5 12 H19 M12 5 V19" fill="none" stroke="currentColor" stroke-width="3.2"/>
 {:else if name==='minus'}
  <path d="M5 12 H19" fill="none" stroke="currentColor" stroke-width="3.2"/>
 {:else if name==='help'}
  <path d="M8.2 8.6 C8.2 3.8 15.8 3.8 15.8 8.4 C15.8 11.4 12 11.4 12 14.6" fill="none" stroke="currentColor" stroke-width="2.6"/>
  <circle cx="12" cy="19.4" r="1.7" fill="currentColor"/>
 {:else if name==='settings'}
  <path d="M3.5 6 H20.5 M3.5 12 H20.5 M3.5 18 H20.5" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="8.5" cy="6" r="2.5" fill="currentColor" stroke={ink} stroke-width="1.1"/>
  <circle cx="15.5" cy="12" r="2.5" fill="currentColor" stroke={ink} stroke-width="1.1"/>
  <circle cx="8.5" cy="18" r="2.5" fill="currentColor" stroke={ink} stroke-width="1.1"/>
 {:else if name==='close'}
  <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.8"/>
 {:else if name==='chevron'}
  <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.8"/>
 {:else if name==='stop'}
  <rect x="5.5" y="5.5" width="13" height="13" rx="2.6" fill="currentColor" stroke={ink} stroke-width="1.2"/>
 {:else if name==='sound'}
  <path d="M3.5 9 H7.2 L12.2 4.6 V19.4 L7.2 15 H3.5Z" fill="currentColor" stroke={ink} stroke-width="1.1"/>
  <path d="M15.4 8.8 Q17.6 12 15.4 15.2 M18 6.2 Q22.4 12 18 17.8" fill="none" stroke="currentColor" stroke-width="2"/>
 {:else if name==='mute'}
  <path d="M3.5 9 H7.2 L12.2 4.6 V19.4 L7.2 15 H3.5Z" fill="currentColor" stroke={ink} stroke-width="1.1"/>
  <path d="M15.4 9.4 L20.4 14.6 M20.4 9.4 L15.4 14.6" fill="none" stroke="currentColor" stroke-width="2.2"/>
 {/if}
</svg>
