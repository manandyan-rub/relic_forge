<script lang="ts">
 import { tr } from './i18n';
 import UiIcon from './UiIcon.svelte';
 let { bet, balance, locked, canSpin, busy, auto, turbo, autoAllowed, turboAllowed, canOpenBonus, openBonus, change, spin, toggleAuto, toggleTurbo }: { bet: string; balance: string; locked: boolean; canSpin: boolean; busy: boolean; auto: number; turbo: boolean; autoAllowed: boolean; turboAllowed: boolean; canOpenBonus:boolean;openBonus:()=>void; change: (n: number) => void; spin: () => void; toggleAuto: () => void; toggleTurbo: () => void } = $props();
</script>
<footer class="bet-controls">
 <div class="bet-controls-left">
 <div class="wallet"><small>{tr("BALANCE")}</small><strong>{balance}</strong></div>
 <div class="bet-picker"><button disabled={locked} onclick={() => change(-1)} aria-label={tr("Decrease bet")}><UiIcon name="minus" size={20}/></button><div><small>{tr("BET")}</small><strong>{bet}</strong></div><button disabled={locked} onclick={() => change(1)} aria-label={tr("Increase bet")}><UiIcon name="plus" size={20}/></button></div>
 </div>
 <button class="spin-button" disabled={!canSpin} onclick={spin} aria-label={tr("Spin")}><UiIcon name="spin" size={40}/><span>{busy ? tr('SPINNING') : tr('SPIN')}</span></button>
 <div class="bet-controls-right">
 <button class="secondary-control" class:active={auto>0} disabled={!autoAllowed || (locked && auto===0)} onclick={toggleAuto} aria-label={auto ? tr('Stop autoplay') : tr('Start 10 autoplay spins')}>{#if auto}<span>{auto}</span>{:else}<UiIcon name="spin" size={32}/>{/if}<small>{auto ? tr('STOP AUTO') : tr('AUTO PLAY')}</small></button>
 <button class="secondary-control" class:active={turbo} disabled={!turboAllowed} onclick={toggleTurbo} aria-label={tr("Toggle turbo")} aria-pressed={turbo}><UiIcon name="turbo" size={32}/><small>{tr("TURBO")}</small></button>
 <button class="bonus-buy-button" disabled={!canOpenBonus} onclick={openBonus} aria-label={tr("Open Bonus Buy")}><UiIcon name="flower" size={27}/><span>{tr("BONUS BUY")}<small>{tr("10 FREE SPINS")}</small></span></button>
 </div>
</footer>
