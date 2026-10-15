<script lang="ts">
 import { art, worldLabels } from './config';
 import type { SymbolId, World } from './types';
 let { symbol, world }: { symbol: SymbolId; world: World } = $props();
</script>
<div class="symbol symbol-{symbol}" aria-label={worldLabels[world][symbol]}>
 {#if ['keeper','traveler','guardian'].includes(symbol)}
  <img src={art(world,symbol === 'keeper' ? 'keeper-symbol' : symbol)} alt="" />
 {:else if ['flower','lantern','key','book','mushroom'].includes(symbol)}
  <img class="prop-art" src={art(world,symbol)} alt=""/>
 {:else}
  <svg viewBox="0 0 100 100" aria-hidden="true" class="object-symbol">
    <path d="M50 58 Q42 77 53 94 M51 79 Q26 58 23 77 Q34 90 51 85 M50 71 Q75 55 78 70 Q68 85 51 80" fill="#678446" stroke="#2d492c" stroke-width="2"/>
    {#each [0,60,120,180,240,300] as angle (angle)}<ellipse cx="50" cy="27" rx="12" ry="20" transform="rotate({angle} 50 45)" fill={symbol === 'wild' ? '#f5d692' : symbol === 'scatter' ? '#e9bd73' : '#d68b99'} stroke="#895b50" stroke-width="2"/>{/each}<circle cx="50" cy="45" r="11" fill="#f6cf6c" stroke="#936135" stroke-width="3"/>
  </svg>
 {/if}
 {#if symbol === 'wild' || symbol === 'scatter'}<span class="symbol-tag">{symbol === 'wild' ? 'WILD' : 'SCATTER'}</span>{/if}
</div>
