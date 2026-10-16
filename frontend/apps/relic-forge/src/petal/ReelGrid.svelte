<script lang="ts">
 import UiIcon from './UiIcon.svelte';
 import type { SymbolId, World, Wild, LineWin } from './types';
 import WinningPayline from './WinningPayline.svelte';
 import ReelSymbol from './ReelSymbol.svelte';
 import ExpandingWild from './ExpandingWild.svelte';
 let { board, world, spinning, wilds, sticky, highlights, line, reduced }: { board: SymbolId[][]; world: World; spinning: boolean; wilds: Wild[]; sticky: boolean; highlights: string[]; line?: LineWin; reduced: boolean } = $props();
</script>
<div class="reel-cabinet" class:reels-moving={spinning} aria-label="Five reels, five rows, twenty paylines">
 <div class="cabinet-top"><span><UiIcon name="sparkle" size={17}/></span><span>{world === 'BLOOM' ? 'THE ENCHANTED GARDEN' : 'THE WITHERED GARDEN'}</span><span><UiIcon name="sparkle" size={17}/></span></div>
 <div class="reel-window">
  {#each board as column, r (r)}<div class="reel-column" class:locked={sticky && wilds.some(w => w.reel === r)} style:--reel={r}>
   {#each column as symbol, row (row)}<div class="reel-cell" class:winning={highlights.includes(`${r}:${row}`)}><ReelSymbol {symbol} {world}/></div>{/each}
   {#if spinning && !(sticky && wilds.some(w => w.reel === r))}
    <div class="reel-spin-viewport" aria-hidden="true"><div class="reel-spin-track">
     {#each [0,1,2] as copy (copy)}
      {#each column as symbol,row (row)}<div class="reel-spin-cell"><ReelSymbol {symbol} {world}/></div>{/each}
     {/each}
    </div></div>
   {/if}
  </div>{/each}
  <div class="wild-layer">{#each wilds as wild (wild.reel)}<ExpandingWild {wild} {world} {sticky}/>{/each}</div>
  {#if !spinning && line}{#key line}<WinningPayline {line} {world} {reduced}/>{/key}{/if}
 </div>
 <div class="cabinet-bottom"><span>20 FIXED LINES</span><span><UiIcon name="flower" size={17}/></span><span>5,000× MAX WIN</span></div>
</div>
