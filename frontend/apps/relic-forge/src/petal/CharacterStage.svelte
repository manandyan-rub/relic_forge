<script lang="ts">
 import { fade } from 'svelte/transition';
 import UiIcon from './UiIcon.svelte';
 import { art } from './config';
 import type { World, Reaction } from './types';
 let { world, reaction, moving, feature, reduced, sound, winnings, hasWin }: { world: World; reaction: Reaction; moving: boolean; feature: boolean; reduced: boolean; sound: boolean; winnings: string; hasWin: boolean } = $props();
 let celebration = $state(false);
 let visible = $state(false);
 let video = $state<HTMLVideoElement>();
 let soundtrack = $state<HTMLAudioElement>();
 const name = $derived(world==='BLOOM'?'bloom-traveler':'blight-keeper');
 const loopRevision = $derived(world==='BLOOM' ? 'clean-specks-6' : 'blight-clean-1');
 const mediaRevision = $derived(feature ? loopRevision : 'clean-matte-2');
 const still = $derived(world==='BLOOM' ? art(world,'traveler-stage') : `/art/${name}-spin-poster.webp?v=${loopRevision}`);
 const phase = $derived(reduced ? null : feature ? 'spin' : celebration ? 'big' : null);
 $effect(()=>{void world;celebration=false;});
 $effect(()=>{if(feature || moving || reduced)celebration=false;else if(reaction==='big')celebration=true;});
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
  const failed=()=>{if(!cancelled){cancelFrame();visible=false;if(clipPhase==='big')celebration=false;}};
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
 $effect(()=>{
  const element=soundtrack;if(!element)return;
  if(phase==='big' && !feature && sound && visible){element.volume=.7;element.currentTime=video?.currentTime??0;void element.play().catch(()=>{});}
  else{element.pause();element.currentTime=0;}
  return ()=>element.pause();
 });
 function cinematicKey(event: KeyboardEvent){
  if(phase!=='big')return;
  if(event.code==='Space'||event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')celebration=false;}
 }
</script>
<svelte:window onkeydown={cinematicKey}/>
{#key `${name}-${phase}`}
 {#if phase==='big' && !feature}<audio bind:this={soundtrack} src={`/art/${name}-${phase}.mp3`} preload="auto"></audio>{/if}
{/key}
<aside class="character-stage" class:cinematic-active={phase==='big'} data-reaction={reaction} aria-label={`${world === 'BLOOM' ? 'The Lantern Traveler' : 'The Withered Keeper'}: ${reaction}`}>
 {#if world==='BLOOM'}<div class="character-aura"></div>{/if}
 <div class="character-figure" class:has-motion={!!phase} class:motion-active={visible && !!phase}>
  <img class="character-art" src={still} alt={world === 'BLOOM' ? 'Magical forest traveler holding a lantern staff' : 'Hooded Blight creature with a chained weapon'} />
  {#if phase==='big'}<div class="cinematic-backdrop" out:fade={{duration:reduced?0:180}} class:cinematic-ready={visible} style:--cinematic-scene={`url('${art(world,'room')}')`} aria-hidden="true"><img class="cinematic-fallback" src={`/art/${name}-big-poster.webp?v=${mediaRevision}`} alt=""/></div>{/if}
  {#key `${name}-${phase}`}
   {#if phase}<video bind:this={video} out:fade={{duration:reduced?0:180}} class="character-motion" class:cinematic={phase==='big'} data-phase={phase} src={`/art/${name}-${phase}.webm?v=${mediaRevision}`} poster={`/art/${name}-${phase}-poster.webp?v=${mediaRevision}`} muted playsinline loop={phase==='spin'} preload="auto" aria-hidden="true" onended={()=>celebration=false}></video>{/if}
  {/key}
  {#if phase==='big'}<button class="cinematic-close" onclick={()=>celebration=false} aria-label="Close big win animation"><UiIcon name="close" size={22}/></button>{/if}
  {#if hasWin && phase==='big' && visible}<div class="character-winnings" class:cinematic-win={phase==='big'} class:windfall={reaction==='big'}><small>{phase==='big'?'BIG WIN':'YOU WON'}</small><strong>{winnings}</strong></div>{/if}
 </div>
 <div class="character-caption"><small>{world === 'BLOOM' ? 'EVERY FLOWER HOLDS A LITTLE' : 'EVEN IN DARKNESS, THERE IS'}</small><strong>{world === 'BLOOM' ? 'Magic.' : 'Power.'}</strong><span>{world === 'BLOOM' ? 'Let your fortune blossom.' : 'See what the shadows keep.'}</span></div>
</aside>
