<script lang="ts">
 import { art } from './config';
 import type { World, Reaction } from './types';
 let { world, reaction, moving, feature, reduced, sound, winnings, hasWin }: { world: World; reaction: Reaction; moving: boolean; feature: boolean; reduced: boolean; sound: boolean; winnings: string; hasWin: boolean } = $props();
 let celebration = $state(false);
 let visible = $state(false);
 let video = $state<HTMLVideoElement>();
 let soundtrack = $state<HTMLAudioElement>();
 const name = $derived(world==='BLOOM'?'bloom-traveler':'blight-keeper');
 const spinRevision = $derived(world==='BLIGHT'?'original500':'previous-loop500');
 const phase = $derived(reduced ? null : feature ? 'spin' : celebration ? 'big' : null);
 $effect(()=>{void world;celebration=false;});
 $effect(()=>{if(feature || moving || reduced)celebration=false;else if(reaction==='big')celebration=true;});
 $effect(()=>{
  const element=video;visible=false;
  if(!element || !phase){element?.pause();return;}
  let cancelled=false;element.muted=true;element.currentTime=0;
  void element.play().then(()=>{if(!cancelled)visible=true;}).catch(()=>{});
  return ()=>{cancelled=true;element.pause();};
 });
 $effect(()=>{
  const element=soundtrack;if(!element)return;
  if(phase==='big' && !feature && sound){element.volume=.7;element.currentTime=0;void element.play().catch(()=>{});}
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
<aside class="character-stage" data-reaction={reaction} aria-label={`${world === 'BLOOM' ? 'The Lantern Traveler' : 'The Withered Keeper'}: ${reaction}`}>
 <div class="character-aura"></div>
 <div class="character-figure" class:motion-active={visible && !!phase}>
  <img class="character-art" src={art(world,world === 'BLOOM' ? 'traveler-stage' : 'keeper')} alt={world === 'BLOOM' ? 'Magical forest traveler holding a lantern staff' : 'Hooded Blight creature with a chained weapon'} />
  {#key `${name}-${phase}`}
   {#if phase}<video bind:this={video} class="character-motion" class:cinematic={phase==='big'} style:--cinematic-scene={`url('${art(world,'room')}')`} data-phase={phase} src={`/art/${name}-${phase}.webm${phase==='spin'?`?v=${spinRevision}`:''}`} poster={`/art/${name}-${phase}-poster.webp${phase==='spin'?`?v=${spinRevision}`:''}`} muted playsinline loop={phase==='spin'} preload="auto" aria-hidden="true" onended={()=>celebration=false} onerror={()=>visible=false}></video>{/if}
  {/key}
  {#if phase==='big'}<button class="cinematic-close" onclick={()=>celebration=false} aria-label="Close big win animation">×</button>{/if}
  {#if hasWin && phase==='big'}<div class="character-winnings" class:cinematic-win={phase==='big'} class:windfall={reaction==='big'}><small>{phase==='big'?'BIG WIN':'YOU WON'}</small><strong>{winnings}</strong></div>{/if}
 </div>
 <div class="character-caption"><small>{world === 'BLOOM' ? 'EVERY FLOWER HOLDS A LITTLE' : 'EVEN IN DARKNESS, THERE IS'}</small><strong>{world === 'BLOOM' ? 'Magic.' : 'Power.'}</strong><span>{world === 'BLOOM' ? 'Let your fortune blossom.' : 'See what the shadows keep.'}</span></div>
</aside>
