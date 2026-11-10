<script lang="ts">
 import { tr } from './i18n';
 import { art, worldLabels } from './config';
 import type { SymbolId, World } from './types';
 let { symbol, world }: { symbol: SymbolId; world: World } = $props();
 const uid = $props.id();
 const bloom = $derived(world === 'BLOOM');
 // Ink + paper palette shared with the supplied hand-drawn props.
 const ink = $derived(bloom ? '#4a2f22' : '#170d0b');
 const paperA = $derived(bloom ? '#fff4d6' : '#4a3433');
 const paperB = $derived(bloom ? '#e6c88a' : '#211514');
 const gold = $derived(bloom ? '#c9933f' : '#c08a52');
 const petalA = $derived(bloom ? '#fbe6c4' : '#b48aa9');
 const petalB = $derived(bloom ? '#e59a8f' : '#5d3655');
 const petalC = $derived(bloom ? '#f6c9a2' : '#8a5b80');
 const leaf = $derived(bloom ? '#6f8d48' : '#4b5136');
 const label = $derived(symbol === 'wild' ? tr('WILD') : tr('SCATTER'));
 const petal = 'M0 0 C -9 -9 -8 -24 0 -30 C 8 -24 9 -9 0 0Z';
</script>
<div class="symbol symbol-{symbol}" aria-label={worldLabels[world][symbol]}>
 {#if ['keeper','traveler','guardian'].includes(symbol)}
  <img src={art(world,symbol === 'keeper' ? 'keeper-symbol' : symbol)} alt="" draggable="false" />
 {:else if ['flower','lantern','key','book','mushroom'].includes(symbol)}
  <img class="prop-art" src={art(world,symbol)} alt="" draggable="false"/>
 {:else}
  <svg viewBox="0 0 100 100" aria-hidden="true" class="object-symbol special-symbol">
   <defs>
    <!-- A faint displacement gives the vector outlines the same wobbly, inked edge as the drawings. -->
    <filter id="ink-{uid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={symbol==='wild'?3:7}/><feDisplacementMap in="SourceGraphic" scale="1.25"/></filter>
    <radialGradient id="paper-{uid}" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color={paperA}/><stop offset="1" stop-color={paperB}/></radialGradient>
    <linearGradient id="petal-{uid}" x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color={petalB}/><stop offset="1" stop-color={petalA}/></linearGradient>
   </defs>
   {#if symbol === 'wild'}
    <g class="wild-halo"><circle cx="50" cy="44" r="45" fill={bloom ? '#ffe7a8' : '#9d4f6d'} opacity=".28"/></g>
    <g filter="url(#ink-{uid})">
     <circle cx="50" cy="44" r="39" fill="url(#paper-{uid})" stroke={ink} stroke-width="2.6"/>
     <circle cx="50" cy="44" r="34" fill="none" stroke={gold} stroke-width="1.2" stroke-dasharray="1.5 2.6"/>
     <path d="M50 66 C 36 70 24 66 18 58 C 28 54 40 56 50 66Z M50 66 C 64 70 76 66 82 58 C 72 54 60 56 50 66Z" fill={leaf} stroke={ink} stroke-width="1.4"/>
     <g transform="translate(50 44)"><g class="wild-bloom">
      {#each [0,45,90,135,180,225,270,315] as a (a)}<path d={petal} transform="rotate({a}) scale(.95)" fill="url(#petal-{uid})" stroke={ink} stroke-width="1.5"/>{/each}
      {#each [22.5,67.5,112.5,157.5,202.5,247.5,292.5,337.5] as a (a)}<path d={petal} transform="rotate({a}) scale(.62)" fill={petalC} stroke={ink} stroke-width="1.3"/>{/each}
      <circle r="7" fill={gold} stroke={ink} stroke-width="1.6"/>
      {#each [0,72,144,216,288] as a (a)}<circle cx="0" cy="-3.4" r="1.2" fill={ink} transform="rotate({a})"/>{/each}
     </g></g>
    </g>
   {:else}
    <g transform="translate(50 42)"><g class="scatter-rays">
     {#each Array.from({length:12},(_,i)=>i*30) as a (a)}<path d="M-2.4 -18 L0 -47 L2.4 -18Z" transform="rotate({a})" fill={bloom ? '#ffd98a' : '#c88ab8'} opacity=".55"/>{/each}
    </g></g>
    <circle cx="50" cy="42" r="27" fill={bloom ? '#fff1c7' : '#5a2f4d'} opacity=".55"/>
    <g filter="url(#ink-{uid})">
     <path d="M50 88 C 48 74 52 64 50 54" fill="none" stroke={ink} stroke-width="5"/>
     <path d="M50 88 C 48 74 52 64 50 54" fill="none" stroke={leaf} stroke-width="2.6"/>
     <path d="M50 76 C 40 74 33 68 31 62 C 39 61 46 66 50 76Z" fill={leaf} stroke={ink} stroke-width="1.3"/>
     <g transform="translate(50 42)">
      {#each [0,72,144,216] as a (a)}<path d={petal} transform="rotate({a}) scale(.78)" fill="url(#petal-{uid})" stroke={ink} stroke-width="1.6"/>{/each}
      <circle r="6.5" fill={gold} stroke={ink} stroke-width="1.6"/>
     </g>
     <!-- The last petal drifting away from the flower. -->
     <g class="last-petal"><path d={petal} transform="translate(72 64) rotate(128) scale(.62)" fill="url(#petal-{uid})" stroke={ink} stroke-width="1.6"/></g>
    </g>
   {/if}
   <g class="symbol-ribbon" filter="url(#ink-{uid})">
    <path d="M10 80 L18 76 L18 92 L10 96 L14 88Z M90 80 L82 76 L82 92 L90 96 L86 88Z" fill={bloom ? '#9b4f3d' : '#3d1f33'} stroke={ink} stroke-width="1.3"/>
    <path d="M17 76 Q50 70 83 76 L83 92 Q50 86 17 92Z" fill={symbol === 'wild' ? (bloom ? '#5f7d3f' : '#40432d') : (bloom ? '#b8563f' : '#6b2c55')} stroke={ink} stroke-width="1.6"/>
   </g>
   <text class="symbol-word" x="50" y="87.4" text-anchor="middle" textLength={label.length > 7 ? 60 : undefined} lengthAdjust="spacingAndGlyphs">{label}</text>
  </svg>
 {/if}
</div>
