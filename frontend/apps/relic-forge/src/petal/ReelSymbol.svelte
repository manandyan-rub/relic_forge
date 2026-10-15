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
   <defs><linearGradient id="gold-{symbol}" x2="1" y2="1"><stop stop-color="#ffe6a0"/><stop offset="1" stop-color="#997035"/></linearGradient></defs>
   {#if symbol === 'flower' || symbol === 'scatter' || symbol === 'wild'}
    <path d="M50 58 Q42 77 53 94 M51 79 Q26 58 23 77 Q34 90 51 85 M50 71 Q75 55 78 70 Q68 85 51 80" fill="#678446" stroke="#2d492c" stroke-width="2"/>
    {#each [0,60,120,180,240,300] as angle (angle)}<ellipse cx="50" cy="27" rx="12" ry="20" transform="rotate({angle} 50 45)" fill={symbol === 'wild' ? '#f5d692' : symbol === 'scatter' ? '#e9bd73' : '#d68b99'} stroke="#895b50" stroke-width="2"/>{/each}<circle cx="50" cy="45" r="11" fill="#f6cf6c" stroke="#936135" stroke-width="3"/>
   {:else if symbol === 'lantern'}
    <path d="M39 21 Q29 1 50 5 Q71 1 61 21 M28 30 L72 30 L65 85 L35 85Z" fill="#654c31" stroke="#ad8950" stroke-width="4"/><path d="M36 37 L64 37 L60 75 L40 75Z" fill="#edc773"/><path d="M48 69 Q32 59 51 43 Q48 52 58 56 Q63 69 48 69" fill="#fff1be"/><path d="M24 29 L50 15 L76 29 M31 88 H69" fill="#634b2c" stroke="#b99153" stroke-width="5"/>
   {:else if symbol === 'key'}
    <g transform="rotate(32 50 50)" fill="url(#gold-{symbol})" stroke="#75542b" stroke-width="3"><circle cx="50" cy="27" r="20"/><circle cx="50" cy="27" r="9" fill="#e7d7ad"/><path d="M45 46 H55 V79 H70 V89 H45Z"/></g>
   {:else if symbol === 'book'}
    <path d="M22 18 L70 10 L81 80 L31 91 L20 81Z" fill="#6d8664" stroke="#334e3c" stroke-width="4"/><path d="M31 90 L78 80 L78 87 L33 98 L21 87 V80" fill="#eeddb4" stroke="#6c5b38" stroke-width="3"/><path d="M31 17 L41 86 M64 15 L73 80" stroke="#d0b474" stroke-width="3"/><path d="M51 34 L56 43 L67 45 L58 53 L58 65 L49 59 L39 62 L41 50 L34 43 L46 41Z" fill="#e2c57e"/>
   {:else if symbol === 'mushroom'}
    <path d="M43 48 Q45 72 36 88 Q52 98 68 86 Q56 69 58 48" fill="#e6c99c" stroke="#927451" stroke-width="3"/><path d="M12 51 Q16 10 51 10 Q84 13 89 52 Q50 66 12 51" fill="#bd7957" stroke="#754831" stroke-width="4"/><g fill="#f3d9b0"><circle cx="35" cy="32" r="7"/><circle cx="62" cy="27" r="6"/><circle cx="72" cy="46" r="5"/><circle cx="24" cy="47" r="4"/></g>
   {/if}
  </svg>
 {/if}
 {#if symbol === 'wild' || symbol === 'scatter'}<span class="symbol-tag">{symbol === 'wild' ? 'WILD' : 'SCATTER'}</span>{/if}
</div>
