<script lang="ts">
 import { tr, t } from './i18n';
 import UiIcon from './UiIcon.svelte';
 let { bet, balance, win, winning=false, locked, canSpin, busy, stoppable=false, auto, turbo, autoAllowed, turboAllowed, canOpenBonus, openBonus, change, balanceValue=Infinity, spin, stop, toggleAuto, toggleTurbo, betLevels=[], betValue=0, format=(n:number)=>String(n), setBet }: { bet: string; balance: string; win: string; winning?: boolean; locked: boolean; canSpin: boolean; busy: boolean; stoppable?: boolean; auto: number; turbo: boolean; autoAllowed: boolean; turboAllowed: boolean; canOpenBonus:boolean;openBonus:()=>void; balanceValue?: number; change: (n: number) => void; spin: () => void; stop?: () => void; toggleAuto: () => void; toggleTurbo: () => void; betLevels?: number[]; betValue?: number; format?: (n:number)=>string; setBet?: (n:number)=>void } = $props();
 let menu = $state(false);
 let picker = $state<HTMLElement>();
 const first = $derived(betLevels.indexOf(betValue) <= 0);
 const last = $derived(betLevels.indexOf(betValue) >= betLevels.length - 1);
 $effect(()=>{ if(locked) menu=false; });
 $effect(()=>{
  if(!menu) return;
  const away=(e: PointerEvent)=>{ if(picker && !picker.contains(e.target as Node)) menu=false; };
  const key=(e: KeyboardEvent)=>{ if(e.key==='Escape'){ menu=false; e.stopPropagation(); } };
  window.addEventListener('pointerdown',away,true); window.addEventListener('keydown',key,true);
  return ()=>{ window.removeEventListener('pointerdown',away,true); window.removeEventListener('keydown',key,true); };
 });
 // Highest Stake bet level the balance covers (bets must always be one of Stake's levels).
 const maxLevel = $derived([...betLevels].filter(l=>l<=balanceValue+1e-9).sort((a,b)=>b-a)[0]);
 function choose(level: number){ setBet?.(level); menu=false; }
 function press(){ if(stoppable) stop?.(); else spin(); }
</script>
<!-- Layout follows Engine's reference bar: readouts at the left, Auto · Spin · Turbo
     grouped in the centre, bet −/+ and Bonus Buy at the right. -->
<footer class="bet-controls bar-v2" class:auto-running={auto>0}>
 <div class="bar-side bar-left">
  <div class="readout wallet"><small>{tr("BALANCE")}</small><strong>{balance}</strong></div>
  <span class="bar-rule" aria-hidden="true"></span>
  <div class="readout win-meter" class:lit={winning}><small>{tr("WIN")}</small><strong>{win}</strong></div>
 </div>
 <div class="bar-center">
  <button class="secondary-control token" class:active={auto>0} disabled={!autoAllowed || (locked && auto===0)} onclick={toggleAuto} aria-label={auto ? tr('Stop autoplay') : tr('Start 10 autoplay spins')}><span class="token-face">{#if auto}<b>{auto}</b>{:else}<UiIcon name="auto" size={24}/>{/if}</span><small>{auto ? tr('STOP AUTO') : tr('AUTO PLAY')}</small></button>
  <button class="spin-button" class:spinning={busy} class:stop-mode={stoppable} disabled={!canSpin && !stoppable} onclick={press} aria-label={stoppable ? tr('Stop') : tr("Spin")}>
   {#if stoppable}<UiIcon name="stop" size={28}/>{:else}<UiIcon name="spin" size={36}/>{/if}
   <span class="spin-label">{stoppable ? tr('Stop') : tr('SPIN')}</span>
  </button>
  <button class="secondary-control token" class:active={turbo} disabled={!turboAllowed} onclick={toggleTurbo} aria-label={tr("Toggle turbo")} aria-pressed={turbo}><span class="token-face"><UiIcon name="turbo" size={24}/></span><small>{tr("TURBO")}</small></button>
 </div>
 <div class="bar-side bar-right">
  <div class="bet-picker" bind:this={picker}>
   <button class="bet-step" disabled={locked || first} onclick={() => change(-1)} aria-label={tr("Decrease bet")}><UiIcon name="minus" size={18}/></button>
   <button class="bet-value readout" disabled={locked || !betLevels.length} onclick={()=>menu=!menu} aria-haspopup="listbox" aria-expanded={menu} aria-label={tr("BET")}><small>{tr("BET")}<UiIcon name="chevron" size={10}/></small><strong>{bet}</strong></button>
   <button class="bet-step" disabled={locked || last} onclick={() => change(1)} aria-label={tr("Increase bet")}><UiIcon name="plus" size={18}/></button>
   {#if menu}
    <div class="bet-menu" role="listbox" aria-label={tr("BET")}>
     {#if maxLevel !== undefined}<button class="bet-max" role="option" aria-selected={maxLevel===betValue} onclick={()=>choose(maxLevel!)}>{t('maximum')} · {format(maxLevel)}</button>{/if}
     {#each betLevels as level (level)}<button role="option" aria-selected={level===betValue} class:current={level===betValue} onclick={()=>choose(level)}>{format(level)}</button>{/each}
    </div>
   {/if}
  </div>
  <button class="bonus-buy-button" disabled={!canOpenBonus} onclick={openBonus} aria-label={tr("Open Bonus Buy")}><UiIcon name="flower" size={26}/><span>{tr("BONUS BUY")}<small>{tr("10 FREE SPINS")}</small></span></button>
 </div>
</footer>
