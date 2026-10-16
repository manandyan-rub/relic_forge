<script lang="ts">
 import UiIcon from './UiIcon.svelte';
 import type { World } from './types';
 let { world, locked, available, select }: { world: World; locked: boolean; available: (w: World) => boolean; select: (w: World) => void } = $props();
</script>
<div class="world-selection" aria-label="Choose your world">
 {#each ['BLOOM','BLIGHT'] as w (w)}
  <button class:chosen={world === w} class="world-choice" disabled={locked || !available(w as World)} aria-pressed={world === w} onclick={() => select(w as World)}>
   <span class="world-icon"><UiIcon name={w==='BLOOM'?'flower':'castle'} size={26}/></span><span><strong>{w === 'BLOOM' ? 'Bloom' : 'Blight'}</strong><small>{w === 'BLOOM' ? 'A gentler kind of magic' : 'Dare the darker path'}</small></span><span class="world-dot"></span>
  </button>
 {/each}
</div>
