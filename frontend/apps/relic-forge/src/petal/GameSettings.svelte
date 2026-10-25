<script lang="ts">
 import { tr, t, number as num } from './i18n';
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
<div class="modal-scrim"><section bind:this={dialog} class="petal-modal" role="dialog" aria-modal="true" aria-label={panel==='rules'?t('rules'):t('settings')} tabindex="-1">
 <button class="modal-close" onclick={close} aria-label={tr('Close dialog')}><UiIcon name="close" size={22}/></button>
 <span class="eyebrow">THE LAST PETAL</span><h2>{panel==='rules'?t('rules'):t('settings')}</h2>
 {#if panel==='settings'}
  <label class="setting"><span>{t('sound')}</span><input type="checkbox" checked={sound} onchange={e=>setSound(e.currentTarget.checked)}/></label>
  <label class="setting"><span>{t('reduceMotion')}</span><input type="checkbox" checked={reduced} onchange={e=>setReduced(e.currentTarget.checked)}/></label>
  <p>{t('turboInfo')}</p>
 {:else}
  <p>{t('rulesBoard')}</p><p>{t('rulesWild')}</p><p>{t('rulesBuy')}</p>
  <table><thead><tr><th>{t('symbol')}</th><th>{num(3)}</th><th>{num(4)}</th><th>{num(5)}</th></tr></thead><tbody>{#each Object.entries(rules.paytable) as [id,pays] (id)}<tr><th>{worldLabels[world][id as SymbolId]}</th>{#each pays as p (p)}<td>{num(p/100)}×</td>{/each}</tr>{/each}</tbody></table>
  <p>{t('rulesCap')}</p><h3>{t('chooseWorld')}</h3><p>{t('rulesWorlds')}</p>
  <details><summary>{t('allPaylines')}</summary><div class="payline-map" dir="ltr">{#each rules.lines as line,i (i)}<svg viewBox="0 0 90 90" aria-label={`${t('line')} ${num(i+1)}: ${line.map(r=>num(r+1)).join(', ')}`}><text x="0" y="9">{i+1}</text>{#each line as row,r (r)}<circle cx={10+r*17} cy={14+row*16} r="2"/>{/each}<polyline points={line.map((row,r)=>`${10+r*17},${14+row*16}`).join(' ')} fill="none" stroke="currentColor" stroke-width="2"/></svg>{/each}</div></details>
  <details><summary>{t('devMath')}</summary><p>{t('devInfo')}</p>{#each statistics as s (s.mode)}<p><b>{s.mode}</b>: {t('weightedRtp')} {num(s.weightedRtp*100,{minimumFractionDigits:5,maximumFractionDigits:5})}% · {t('bonusChance')} 1:{num(Math.round(1/s.bonusFrequency))} · {t('hit')} {num(s.hitFrequency*100,{maximumFractionDigits:2})}% · {t('standardDeviation')} {num(s.standardDeviationX,{maximumFractionDigits:2})}×.</p>{/each}</details>
  <details><summary>{world} · {t('bonusBuy')} · {t('devMath')}</summary><p>{t('rulesCost')}</p>{#each bonusStatistics.filter(s=>s.world===world) as s (s.mode)}<p><b>{t(s.variant.toLowerCase() as 'standard'|'super'|'mythic')}</b>: {t('price')} {num(s.costMultiplier)}× {t('baseBet')} · {t('weightedRtp')} {num(s.weightedRtp*100,{minimumFractionDigits:5,maximumFractionDigits:5})}% · {t('standardDeviation')} {num(s.standardDeviationPurchaseX,{maximumFractionDigits:4})}× · {t('maximum')} {num(s.maxPayoutPurchaseX,{maximumFractionDigits:4})}×.</p>{/each}</details>
 {/if}
</section></div>
