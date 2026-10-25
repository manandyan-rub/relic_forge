<script lang="ts">
 import { tr, t } from './i18n';
 import type { Wild, World } from './types';
 let { wild, world, sticky }: { wild: Wild; world: World; sticky: boolean } = $props();
</script>
<div class="expanded-wild" class:sticky style:grid-column={wild.reel+1} aria-label={`${t('reel')} ${wild.reel+1}, ${sticky?t('stickyWild'):t('petalWild')}, ${wild.multiplier}×`}>
 <svg viewBox="0 0 100 500" preserveAspectRatio="none" aria-hidden="true"><path d="M50 510 Q5 420 50 360 Q95 300 48 240 Q3 180 50 120 Q95 60 50 -10 M48 400 Q5 380 13 335 M50 280 Q90 260 87 220 M50 150 Q12 130 17 100" fill="none" stroke="currentColor" stroke-width="5"/>
 {#each [70,190,330,440] as y (y)}<path d="M50 {y} Q15 {y-50} 22 {y-55} Q60 {y-42} 50 {y} M50 {y} Q85 {y-50} 80 {y-55} Q40 {y-40} 50 {y}" fill="currentColor"/>{/each}</svg>
 <div class="wild-badge"><span>{world === 'BLOOM' ? '❀' : '✦'}</span><strong>{wild.multiplier}×</strong><small>{sticky ? tr('STICKY WILD') : tr('PETAL WILD')}</small></div>
</div>
