<script lang="ts">
 import UiIcon from './UiIcon.svelte';
 import { onMount } from 'svelte';
 import { rules, worldLabels } from './config';
 import statistics from './statistics.json';
 import bonusStatistics from './bonus-statistics.json';
 import type { SymbolId, World } from './types';
 let { panel, world, close, reduced, setReduced, sound, setSound }: { panel: 'rules' | 'settings'; world: World; close: () => void; reduced: boolean; setReduced: (v: boolean) => void; sound: boolean; setSound: (v: boolean) => void } = $props();
 let dialog: HTMLElement;
 onMount(()=>{
  const previous=document.activeElement as HTMLElement;
  dialog.querySelector<HTMLElement>('button')?.focus();
  const trap=(e:KeyboardEvent)=>{
   if(e.key!=='Tab')return;
   const focusable=[...dialog.querySelectorAll<HTMLElement>('button,input,summary,[tabindex="0"]')];
   const first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',trap);
  return()=>{document.removeEventListener('keydown',trap);previous?.focus({preventScroll:true});};
 });
</script>
<div class="modal-scrim"><section bind:this={dialog} class="petal-modal" role="dialog" aria-modal="true" aria-label={panel === 'rules' ? 'Game rules and paytable' : 'Game settings'} tabindex="-1">
 <button class="modal-close" onclick={close} aria-label="Close dialog"><UiIcon name="close" size={22}/></button>
 <span class="eyebrow">THE LAST PETAL</span><h2>{panel === 'rules' ? 'A little garden magic' : 'Make yourself at home'}</h2>
 {#if panel === 'settings'}
  <label class="setting"><span>Sound effects</span><input type="checkbox" checked={sound} onchange={e => setSound(e.currentTarget.checked)}/></label>
  <label class="setting"><span>Reduce motion</span><input type="checkbox" checked={reduced} onchange={e => setReduced(e.currentTarget.checked)}/></label>
  <p>Turbo shortens the presentation. Your outcome and winnings stay the same.</p>
 {:else}
  <p>Five reels, five rows, 20 fixed paylines. Matching symbols pay from the leftmost reel. All lines are included in your displayed bet.</p>
  <p><b>3 Scatters award 10 Free Spins.</b> Petal Wilds expand across their reel. During Free Spins they stay in place with their multiplier. Multipliers on a winning line add together once per reel. Wilds substitute for paying symbols; an all-Wild line pays the Keeper. There are no retriggers.</p>
  <p><b>Bonus Buy:</b> Standard grants 10 Free Spins with normal expanding Wilds. Super guarantees an expanding Wild reel on the first spin. Mythic guarantees an enhanced starting Wild: at least 8× in Bloom or 20× in Blight. New Wild reels stay sticky. The panel shows the full purchase cost before a separate confirmation. A guaranteed Wild does not guarantee a win. Connected purchases remain locked pending production validation and jurisdiction approval.</p>
  <table><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>{#each Object.entries(rules.paytable) as [id,pays] (id)}<tr><th>{worldLabels[world][id as SymbolId]}</th>{#each pays as p (p)}<td>{p/100}×</td>{/each}</tr>{/each}</tbody></table>
  <p>Amounts above are multiples of the total bet. The maximum total return is 5,000×. At the cap, credited wins stop in payline order and the feature ends.</p>
  <h3>Choose your world</h3><p>Bloom offers more frequent, smaller features. Blight offers rarer features and a wider range of payouts.</p>
  <details><summary>Show all 20 paylines</summary><div class="payline-map">{#each rules.lines as line,i (i)}<svg viewBox="0 0 90 90" aria-label={`Line ${i+1}: ${line.map(r => r+1).join(', ')}`}><text x="0" y="9">{i+1}</text>{#each line as row,r (r)}<circle cx={10+r*17} cy={14+row*16} r="2"/>{/each}<polyline points={line.map((row,r) => `${10+r*17},${14+row*16}`).join(' ')} fill="none" stroke="currentColor" stroke-width="2"/></svg>{/each}</div></details>
  <details><summary>Development math information</summary><p>Measured finite development libraries, not certified production math. Deterministic demo fixtures showcase features; they do not sample these probabilities.</p>{#each statistics as s (s.mode)}<p><b>{s.mode}</b>: weighted RTP {(s.weightedRtp*100).toFixed(5)}%, bonus 1 in {Math.round(1/s.bonusFrequency)}, hit {(s.hitFrequency*100).toFixed(2)}%, standard deviation {s.standardDeviationX.toFixed(2)}×.</p>{/each}</details>
  <details><summary>{world} Bonus Buy development math</summary><p>RTP and volatility below use the full purchase cost as their denominator. Maximum payout remains 5,000× the base bet, including all 10 Free Spins; the cap can end a feature early.</p>{#each bonusStatistics.filter(s=>s.world===world) as s (s.mode)}<p><b>{s.variant}</b>: price {s.costMultiplier}× base bet, weighted RTP {(s.weightedRtp*100).toFixed(5)}%, standard deviation {s.standardDeviationPurchaseX.toFixed(4)}× purchase, maximum {s.maxPayoutPurchaseX.toFixed(4)}× purchase.</p>{/each}</details>
 {/if}
</section></div>
