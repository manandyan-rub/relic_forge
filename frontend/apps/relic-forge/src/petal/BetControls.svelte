<script lang="ts">
 let { bet, balance, locked, canSpin, busy, auto, turbo, autoAllowed, turboAllowed, canOpenBonus, openBonus, change, spin, toggleAuto, toggleTurbo }: { bet: string; balance: string; locked: boolean; canSpin: boolean; busy: boolean; auto: number; turbo: boolean; autoAllowed: boolean; turboAllowed: boolean; canOpenBonus:boolean;openBonus:()=>void; change: (n: number) => void; spin: () => void; toggleAuto: () => void; toggleTurbo: () => void } = $props();
</script>
<footer class="bet-controls">
 <div class="wallet"><small>BALANCE</small><strong>{balance}</strong></div>
 <div class="bet-picker"><button disabled={locked} onclick={() => change(-1)} aria-label="Decrease bet">−</button><div><small>BET</small><strong>{bet}</strong></div><button disabled={locked} onclick={() => change(1)} aria-label="Increase bet">+</button></div>
 <button class="spin-button" disabled={!canSpin} onclick={spin} aria-label="Spin"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M36 14 A17 17 0 1 0 40 30 M36 5 V16 H25" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>{busy ? 'SPINNING' : 'SPIN'}</span></button>
 <button class="secondary-control" class:active={auto>0} disabled={!autoAllowed || (locked && auto===0)} onclick={toggleAuto} aria-label={auto ? 'Stop autoplay' : 'Start 10 autoplay spins'}><span>{auto || '↻'}</span><small>{auto ? 'STOP AUTO' : 'AUTO PLAY'}</small></button>
 <button class="secondary-control" class:active={turbo} disabled={!turboAllowed} onclick={toggleTurbo} aria-label="Toggle turbo" aria-pressed={turbo}><span>ϟ</span><small>TURBO</small></button>
 <button class="bonus-buy-button" disabled={!canOpenBonus} onclick={openBonus} aria-label="Open Bonus Buy"><span>❀</span><span>BONUS BUY<small>10 FREE SPINS</small></span></button>
</footer>
