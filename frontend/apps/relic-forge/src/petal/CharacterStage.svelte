<script lang="ts">
 import { tr, t } from './i18n';
 import { fade } from 'svelte/transition';
 import { art } from './config';
 import type { World, Reaction } from './types';
 let { world, reaction, feature, reduced }: { world: World; reaction: Reaction; feature: boolean; reduced: boolean } = $props();
 let visible = $state(false);
 let video = $state<HTMLVideoElement>();
 const name = $derived(world==='BLOOM'?'bloom-traveler':'blight-keeper');
 const loopRevision = $derived(world==='BLOOM' ? 'clean-specks-6' : 'blight-cloak-4');
 const still = $derived(world==='BLOOM' ? art(world,'traveler-stage') : `./art/${name}-spin-poster.webp?v=${loopRevision}`);
 const phase = $derived(!reduced && feature ? 'spin' : null);
 $effect(()=>{
  const element=video, clipPhase=phase;visible=false;
  if(!element || !clipPhase){element?.pause();return;}
  let cancelled=false;
  let videoFrame: number | undefined;
  let paintFrame=0;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const cancelFrame=()=>{
   if(videoFrame!==undefined){element.cancelVideoFrameCallback?.(videoFrame);videoFrame=undefined;}
   cancelAnimationFrame(paintFrame);clearTimeout(fallback);
  };
  const reveal=()=>{
   if(cancelled || element.paused || element.readyState<2)return;
   cancelFrame();visible=true;
  };
  const awaitFrame=()=>{
   cancelFrame();
   if(cancelled || element.readyState<2)return;
   const frameCallbacks=typeof element.requestVideoFrameCallback==='function';
   if(frameCallbacks)videoFrame=element.requestVideoFrameCallback(reveal);
   // Older decoders can signal playing before their first frame is composited.
   // Keep the still until a decoded frame has also had a chance to paint.
   fallback=setTimeout(()=>{
    if(cancelled || element.paused || element.readyState<2)return;
    paintFrame=requestAnimationFrame(()=>{paintFrame=requestAnimationFrame(reveal);});
   },frameCallbacks?350:0);
  };
  const waiting=()=>{if(!cancelled){cancelFrame();visible=false;}};
  const failed=()=>{if(!cancelled){cancelFrame();visible=false;}};
  element.addEventListener('playing',awaitFrame);
  element.addEventListener('waiting',waiting);
  element.addEventListener('error',failed);
  element.muted=true;element.currentTime=0;
  void element.play().catch(failed);
  return ()=>{
   cancelled=true;cancelFrame();
   element.removeEventListener('playing',awaitFrame);
   element.removeEventListener('waiting',waiting);
   element.removeEventListener('error',failed);
   element.pause();
  };
 });
</script>
<aside class="character-stage" data-reaction={reaction} aria-label={`${world === 'BLOOM' ? tr('The Lantern Traveler') : tr('The Withered Keeper')}: ${t(({idle:'ready',spin:'spinning',anticipation:'ready',win:'win',wild:'wild',intro:'freeSpins',big:'bigWin',ending:'complete'} as const)[reaction])}`}>
 {#if world==='BLOOM'}<div class="character-aura"></div>{/if}
 <div class="character-figure" class:has-motion={!!phase} class:motion-active={visible && !!phase}>
  <img class="character-art" src={still} alt={world === 'BLOOM' ? tr('Magical forest traveler holding a lantern staff') : tr('Hooded Blight creature with a chained weapon')} />
  {#key `${name}-${phase}`}
   {#if phase}<video bind:this={video} out:fade={{duration:reduced?0:180}} class="character-motion" data-phase={phase} src={`./art/${name}-spin.webm?v=${loopRevision}`} poster={`./art/${name}-spin-poster.webp?v=${loopRevision}`} muted playsinline loop preload="auto" aria-hidden="true"></video>{/if}
  {/key}
 </div>
 <div class="character-caption"><small>{world === 'BLOOM' ? tr('EVERY FLOWER HOLDS A LITTLE') : tr('EVEN IN DARKNESS, THERE IS')}</small><strong>{world === 'BLOOM' ? tr('Magic.') : tr('Power.')}</strong><span>{world === 'BLOOM' ? tr('Let your fortune blossom.') : tr('See what the shadows keep.')}</span></div>
</aside>
