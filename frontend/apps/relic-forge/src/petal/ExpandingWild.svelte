<script lang="ts">
 import { tr, t } from './i18n';
 import type { Wild, World } from './types';
 import rigs from './wild-rigs.json';
 let { wild, world, sticky }: { wild: Wild; world: World; sticky: boolean } = $props();
 // Each world has three character Wilds; the reel picks which one steps in.
 const cast: Record<World, (keyof typeof rigs)[]> = {
  BLOOM: ['bloom-grandma', 'bloom-gnome', 'bloom-traveler'],
  BLIGHT: ['blight-skull', 'blight-brute', 'blight-keeper'],
 };
 const key = $derived(cast[world][wild.reel % 3]);
 const rig = $derived(rigs[key]);
 const src = (name: string) => `./art/wild/${key}-${name}.webp?v=2`;
</script>
<div class="expanded-wild char-wild" class:sticky data-character={key} style:grid-column={wild.reel+1} aria-label={`${t('reel')} ${wild.reel+1}, ${sticky?t('stickyWild'):t('petalWild')}, ${wild.multiplier}×`}>
 <div class="char-wild-head">
  <strong class="char-wild-mult">{wild.multiplier}×</strong>
  <small>{sticky ? tr('STICKY WILD') : tr('PETAL WILD')}</small>
 </div>
 <div class="char-wild-stage">
  <div class="char-rig" style:aspect-ratio={`${rig.width} / ${rig.height}`} style:--ratio={rig.width / rig.height} style:--delay={`${(wild.reel % 3) * -0.9}s`}>
   <img class="char-base" src={src('base')} alt="" draggable="false" />
   {#each rig.parts as part (part.name)}
    <img class="char-part" data-anim={part.anim} src={src(part.name)} alt="" draggable="false"
     style:left={`${part.left}%`} style:top={`${part.top}%`} style:width={`${part.width}%`} style:height={`${part.height}%`}
     style:transform-origin={`${part.originX}% ${part.originY}%`} />
   {/each}
  </div>
 </div>
</div>
