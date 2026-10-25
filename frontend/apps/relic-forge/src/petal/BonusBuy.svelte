<script lang="ts">
 import { tr, t } from './i18n';
 import UiIcon from './UiIcon.svelte';
 import { onMount } from 'svelte';
 import { bonusConfig, bonusModes, variantTitle } from './bonus';
 import { art } from './config';
 import type { World, PurchaseQuote, BonusMode, BonusVariant } from './types';
 let {world,stake,currency,balance,format,reason,close,purchase}: {world:World;stake:number;currency:string;balance:number;format:(n:number)=>string;reason:(mode:BonusMode)=>string;close:()=>void;purchase:(quote:PurchaseQuote)=>Promise<void>}=$props();
 let quote=$state<PurchaseQuote|null>(null), confirming=$state(false);
 let dialog:HTMLElement;
 const options=$derived(bonusModes.filter(m=>bonusConfig[m].world===world));
 const disabledReason=(mode:BonusMode)=>tr(reason(mode))||(!(stake>0)?tr('Select a valid base bet.'):stake*bonusConfig[mode].costMultiplier>balance?tr('Insufficient balance. Lower your base bet to reduce the purchase cost.'):'');
 function select(mode:BonusMode){if(confirming||disabledReason(mode))return;const costMultiplier=bonusConfig[mode].costMultiplier;quote={mode,world,stake,currency,costMultiplier,total:stake*costMultiplier};}
 async function confirm(){if(!quote||confirming||disabledReason(quote.mode))return;confirming=true;await purchase({...quote});confirming=false;}
 onMount(()=>{
  const previous=document.activeElement as HTMLElement;
  dialog.querySelector<HTMLElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!confirming){e.stopPropagation();if(quote)quote=null;else close();}
   if(e.key!=='Tab')return;
   const list=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')];
   if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}
  };
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);previous?.focus({preventScroll:true});};
 });
</script>
<div class="modal-scrim bonus-scrim"><section bind:this={dialog} class="bonus-panel" class:dark-bonus={world==='BLIGHT'} role="dialog" aria-modal="true" aria-label={quote?tr('Confirm Bonus Buy'):tr(`${world} Bonus Buy`)} tabindex="-1" data-bonus-world={world}>
 <button class="modal-close" onclick={close} disabled={confirming} aria-label={tr("Close Bonus Buy")}><UiIcon name="close" size={22}/></button>
 <header class="bonus-heading"><span class="eyebrow">{tr("THE LAST PETAL ·")} {world}</span><h2>{quote?tr('Your next chapter awaits'):world==='BLOOM'?tr('A garden full of possibility'):tr('What sleeps beneath the roots')}</h2><p>{quote?tr('Confirm your purchase to enter the feature.'):tr('Choose a bonus. Ten Free Spins. A little more magic.')}</p></header>
 {#if quote}
  <div class="purchase-confirmation">
   <span class="confirmation-flower">{world==='BLOOM'?'❀':'✦'}</span><h3>{variantTitle(bonusConfig[quote.mode].variant as BonusVariant)}</h3><span class="purchase-world">{world} {tr("· 10 FREE SPINS")}</span>
   <dl><div><dt>{tr("Base bet")}</dt><dd>{format(quote.stake)}</dd></div><div><dt>{tr("Purchase multiplier")}</dt><dd>{quote.costMultiplier}×</dd></div><div class="purchase-total"><dt>{tr("Full purchase cost")}</dt><dd>{format(quote.total)}</dd></div></dl>
   <p>{t('rulesCost')}</p><p>{t('fullCost')} (1×): {format(quote.total)} · {t('maximum')}: {format(quote.stake*5000)}</p>
   <div class="confirmation-actions"><button class="bonus-back" onclick={()=>quote=null} disabled={confirming}>{tr("Back")}</button><button class="bonus-purchase" disabled={confirming||Boolean(disabledReason(quote.mode))} onclick={()=>void confirm()} aria-label={tr("Confirm bonus purchase")}>{confirming?tr('Purchasing…'):tr(`Buy for ${format(quote.total)}`)}</button></div>
  </div>
 {:else}
  <div class="bonus-options">
   {#each options as mode,i (mode)}{@const b=bonusConfig[mode]}{@const why=disabledReason(mode)}
    <article class="bonus-card" data-bonus-mode={mode}><span class="bonus-card-kicker">{i===0?tr('A LITTLE WONDER'):i===1?tr('ROOTED IN MAGIC'):tr('THE RAREST CHAPTER')}</span><div class="bonus-card-art"><div class="bonus-petals">{world==='BLOOM'?'❀':'✦'}</div><img src={art(world,['traveler','guardian','keeper-symbol'][i])} alt=""/></div><h3>{variantTitle(b.variant as BonusVariant)}</h3><div class="bonus-card-detail"><strong>{tr("10 Free Spins")}</strong><p>{b.variant==='STANDARD'?tr('Normal expanding Wilds. Every new Wild reel stays for the feature.'):b.variant==='SUPER'?tr('At least one expanding Wild reel guaranteed on the first Free Spin.'):tr(`A starting Wild of at least ${b.minimumStartingMultiplier}×, guaranteed on the first Free Spin.`)}</p></div><span class="bonus-cost-multiplier">{b.costMultiplier}{tr("× BASE BET")}</span><button class="bonus-select" disabled={Boolean(why)} onclick={()=>select(mode)} aria-label={tr(`Select ${b.variant} bonus`)}>{format(stake*b.costMultiplier)}</button>{#if why}<p class="bonus-unavailable">{why}</p>{/if}</article>
   {/each}
  </div>
  <footer class="bonus-panel-foot"><span>{tr("BASE BET")} <b>{format(stake)}</b> {tr("· BALANCE")} <b>{format(balance)}</b></span><p>{tr("Costs shown are the full purchase amount. Expanding reels stay sticky throughout the feature. No retriggers.")}</p><small>{tr("Development prices and books · Connected purchasing remains locked until production validation.")}</small></footer>
 {/if}
</section></div>
