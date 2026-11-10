<script lang="ts">
 import { tr, t, number as num } from './i18n';
 import type { TextKey } from './i18n';
 import UiIcon from './UiIcon.svelte';
 import ReelSymbol from './ReelSymbol.svelte';
 import { onMount } from 'svelte';
 import { rules, worldLabels } from './config';
 import statistics from './statistics.json';
 import bonusStatistics from './bonus-statistics.json';
 import type { SymbolId, World } from './types';
 type Tab = 'symbols' | 'features' | 'bonus' | 'lines' | 'rtp' | 'controls';
 let { panel, world, close, reduced, setReduced, sound, setSound, bet = 1, format = (n: number) => String(n), turbo = false, turboAllowed = true, setTurbo }: { panel: 'rules' | 'settings'; world: World; close: () => void; reduced: boolean; setReduced: (v: boolean) => void; sound: boolean; setSound: (v: boolean) => void; bet?: number; format?: (n: number) => string; turbo?: boolean; turboAllowed?: boolean; setTurbo?: (v: boolean) => void } = $props();
 let dialog: HTMLElement;
 let tab = $state<Tab>('symbols');
 const worldName = (w: string) => (w === 'BLOOM' ? 'Bloom' : 'Blight');
 const variantName = (v: string) => `${t(v.toLowerCase() as 'standard' | 'super' | 'mythic')} ${t('bonus')}`;
 // RTP, cost and maximum win per mode, straight from the exported math reports.
 const modeRows = [
  ...statistics.map(s => ({ mode: s.mode, world: s.mode, label: t('baseGame'), cost: 1, rtp: s.weightedRtp, max: s.maxExposureX })),
  ...bonusStatistics.map(s => ({ mode: s.mode, world: s.world, label: variantName(s.variant), cost: s.costMultiplier, rtp: s.weightedRtp, max: s.maxPayoutBaseBetX })),
 ];
 const worldBonuses = $derived(bonusStatistics.filter(s => s.world === world));
 const bonusDetail = (variant: string) => variant === 'STANDARD' ? t('normalWild') : variant === 'SUPER' ? t('guaranteedWild') : t('enhancedWild', { n: num(world === 'BLOOM' ? 8 : 20) });
 const tabs: { id: Tab; label: () => string; icon: 'flower' | 'sparkle' | 'turbo' | 'spin' | 'help' | 'settings' }[] = [
  { id: 'symbols', label: () => t('tabSymbols'), icon: 'flower' },
  { id: 'features', label: () => t('tabFeatures'), icon: 'sparkle' },
  { id: 'bonus', label: () => t('bonusBuy'), icon: 'flower' },
  { id: 'lines', label: () => t('tabLines'), icon: 'spin' },
  { id: 'rtp', label: () => t('rtpCol'), icon: 'help' },
  { id: 'controls', label: () => t('controlsTitle'), icon: 'settings' },
 ];
 const controls: { icon: 'spin' | 'plus' | 'auto' | 'turbo' | 'flower' | 'castle' | 'help'; key: TextKey }[] = [
  { icon: 'spin', key: 'guideSpin' }, { icon: 'plus', key: 'guideBet' }, { icon: 'auto', key: 'guideAuto' }, { icon: 'turbo', key: 'guideTurbo' },
  { icon: 'flower', key: 'guideBonus' }, { icon: 'castle', key: 'guideWorld' }, { icon: 'help', key: 'guideIcons' },
 ];
 function selectTab(next: Tab, event?: KeyboardEvent) {
  tab = next;
  if (event) dialog.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
 }
 function tabKeys(event: KeyboardEvent) {
  const i = tabs.findIndex(x => x.id === tab);
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
   event.preventDefault();
   selectTab(tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id, event);
  }
 }
 onMount(() => {
  const previous = document.activeElement as HTMLElement;
  dialog.querySelector<HTMLElement>('button')?.focus();
  const trap = (e: KeyboardEvent) => {
   if (e.key !== 'Tab') return;
   const focusable = [...dialog.querySelectorAll<HTMLElement>('button,input,summary,[tabindex="0"]')].filter(el => !el.closest('[hidden]'));
   const first = focusable[0], last = focusable.at(-1);
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  document.addEventListener('keydown', trap);
  return () => { document.removeEventListener('keydown', trap); previous?.focus({ preventScroll: true }); };
 });
</script>

<div class="modal-scrim">
 <section bind:this={dialog} class="petal-modal" class:rules-dialog={panel === 'rules'} class:settings-dialog={panel === 'settings'} class:blight-dialog={world === 'BLIGHT'} role="dialog" aria-modal="true" aria-label={panel === 'rules' ? t('rules') : t('settings')} tabindex="-1">
  <button class="modal-close" onclick={close} aria-label={tr('Close dialog')}><UiIcon name="close" size={22} /></button>
  <header class="dialog-head">
   <span class="dialog-mark"><UiIcon name={world === 'BLOOM' ? 'flower' : 'castle'} size={24} /></span>
   <div><span class="eyebrow">{tr('THE LAST PETAL')} · {worldName(world)}</span><h2>{panel === 'rules' ? t('rules') : t('settings')}</h2></div>
  </header>

  {#if panel === 'settings'}
   <div class="settings-list">
    <label class="setting"><span class="setting-icon"><UiIcon name={sound ? 'sound' : 'mute'} size={22} /></span><span class="setting-text">{t('sound')}</span><input type="checkbox" role="switch" checked={sound} onchange={e => setSound(e.currentTarget.checked)} /></label>
    <label class="setting"><span class="setting-icon"><UiIcon name="sparkle" size={22} /></span><span class="setting-text">{t('reduceMotion')}</span><input type="checkbox" role="switch" checked={reduced} onchange={e => setReduced(e.currentTarget.checked)} /></label>
    {#if setTurbo}
     <label class="setting" class:setting-disabled={!turboAllowed}><span class="setting-icon"><UiIcon name="turbo" size={22} /></span><span class="setting-text">{t('turbo')}</span><input type="checkbox" role="switch" checked={turbo} disabled={!turboAllowed} onchange={e => setTurbo(e.currentTarget.checked)} /></label>
    {/if}
   </div>
   <p class="settings-note">{t('turboInfo')}</p>
  {:else}
   <p class="rules-intro">{t('rulesBoard')} <span class="bet-note">{t('valuesAtBet', { bet: format(bet) })}</span></p>
   <div class="rules-tabs" role="tablist" aria-label={t('rules')} tabindex="-1" onkeydown={tabKeys}>
    {#each tabs as item (item.id)}
     <button role="tab" data-tab={item.id} aria-selected={tab === item.id} aria-controls={`rules-${item.id}`} tabindex={tab === item.id ? 0 : -1} class:active={tab === item.id} onclick={() => selectTab(item.id)}><UiIcon name={item.icon} size={16} /><span>{item.label()}</span></button>
    {/each}
   </div>
   <div class="tab-panels">
    <div class="tab-panel" id="rules-symbols" role="tabpanel" hidden={tab !== 'symbols'}>
     <div class="special-cards">
      <article class="special-card"><div class="symbol-frame"><ReelSymbol symbol="wild" {world} /></div><div><h3>{worldLabels[world].wild}</h3><p>{t('wildCard')}</p><p class="muted">{t('wildValues')}</p></div></article>
      <article class="special-card"><div class="symbol-frame"><ReelSymbol symbol="scatter" {world} /></div><div><h3>{worldLabels[world].scatter}</h3><p>{t('scatterCard')}</p></div></article>
     </div>
     <table class="paytable"><thead><tr><th>{t('symbol')}</th><th>{num(3)}</th><th>{num(4)}</th><th>{num(5)}</th></tr></thead><tbody>
      {#each Object.entries(rules.paytable) as [id, pays] (id)}
       <tr><th><span class="pay-symbol"><span class="symbol-frame small"><ReelSymbol symbol={id as SymbolId} {world} /></span><span>{worldLabels[world][id as SymbolId]}</span></span></th>
        {#each pays as p, i (i)}<td><strong>{format(bet * p / 100)}</strong><small>{num(p / 100)}×</small></td>{/each}</tr>
      {/each}
     </tbody></table>
     <p class="muted">{t('paytableNote')}</p>
    </div>

    <div class="tab-panel" id="rules-features" role="tabpanel" hidden={tab !== 'features'}>
     <div class="feature-block"><span class="feature-icon"><UiIcon name="sparkle" size={22} /></span><div><h3>{t('freeSpins')}</h3><p>{t('rulesWild')}</p></div></div>
     <div class="feature-block"><span class="feature-icon"><UiIcon name="flower" size={22} /></span><div><h3>{worldLabels[world].wild}</h3><p>{t('wildValues')}</p></div></div>
     <div class="feature-block"><span class="feature-icon"><UiIcon name="castle" size={22} /></span><div><h3>{t('chooseWorld')}</h3><p>{t('rulesWorlds')}</p></div></div>
     <div class="feature-block"><span class="feature-icon"><UiIcon name="turbo" size={22} /></span><div><h3>{t('maxWin')}</h3><p>{t('rulesCap')}</p></div></div>
    </div>

    <div class="tab-panel" id="rules-bonus" role="tabpanel" hidden={tab !== 'bonus'}>
     <p>{t('rulesBuy')}</p>
     <div class="bonus-rows">
      {#each worldBonuses as b (b.mode)}
       <article class="bonus-row"><div><h3>{variantName(b.variant)}</h3><p>{bonusDetail(b.variant)}</p></div><div class="bonus-price"><strong>{format(bet * b.costMultiplier)}</strong><small>{num(b.costMultiplier)}× · {t('rtpCol')} {num(b.weightedRtp * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</small></div></article>
      {/each}
     </div>
    </div>

    <div class="tab-panel" id="rules-lines" role="tabpanel" hidden={tab !== 'lines'}>
     <p class="muted">{t('rulesBoard')}</p>
     <div class="payline-map" dir="ltr">
      {#each rules.lines as line, i (i)}<svg viewBox="0 0 90 90" aria-label={`${t('line')} ${num(i + 1)}: ${line.map(r => num(r + 1)).join(', ')}`}><text x="0" y="9">{i + 1}</text>{#each line as row, r (r)}<circle cx={10 + r * 17} cy={14 + row * 16} r="2" />{/each}<polyline points={line.map((row, r) => `${10 + r * 17},${14 + row * 16}`).join(' ')} fill="none" stroke="currentColor" stroke-width="2" /></svg>{/each}
     </div>
    </div>

    <div class="tab-panel" id="rules-rtp" role="tabpanel" hidden={tab !== 'rtp'}>
     <table class="rtp-table"><thead><tr><th>{t('modeCol')}</th><th>{t('costCol')}</th><th>{t('rtpCol')}</th><th>{t('maxWinCol')}</th></tr></thead><tbody>
      {#each modeRows as row (row.mode)}<tr><th><span class="world-tag" class:dark={row.world === 'BLIGHT'}>{worldName(row.world)}</span> {row.label}</th><td>{num(row.cost)}×</td><td>{num(row.rtp * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td>{num(row.max)}×</td></tr>{/each}
     </tbody></table>
     <p class="muted">{t('rtpNote')}</p>
    </div>

    <div class="tab-panel" id="rules-controls" role="tabpanel" hidden={tab !== 'controls'}>
     <ul class="controls-guide">
      {#each controls as c (c.key)}<li><span class="control-icon"><UiIcon name={c.icon} size={20} /></span><span>{t(c.key)}</span></li>{/each}
     </ul>
    </div>
   </div>
   <footer class="rules-foot"><strong>{t('disclaimerTitle')}</strong><p class="disclaimer">{t('disclaimer')}</p></footer>
  {/if}
 </section>
</div>
