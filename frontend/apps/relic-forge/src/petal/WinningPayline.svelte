<script lang="ts">
 import { t } from './i18n';
 import type { LineWin, World } from './types';
 let { line, world, reduced }: { line: LineWin; world: World; reduced: boolean } = $props();
 const positions = $derived([...line.positions].sort((a,b)=>a.reel-b.reel));
 const points = $derived(positions.map(p=>`${p.reel*20+10},${p.row*20+10}`).join(' '));
</script>

<svg class="winning-payline" class:still={reduced} data-world={world} data-line={line.meta.lineIndex} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${t('line')} ${line.meta.lineIndex} · ${line.kind} ${t('symbol')}`}>
 <title>{t('line')} {line.meta.lineIndex}</title>
 <polyline class="payline-shadow" {points}/>
 <polyline class="payline-glow" {points}/>
 <polyline class="payline-core" {points} pathLength="1"/>
</svg>
