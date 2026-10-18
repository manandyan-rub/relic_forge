<script lang="ts">
 import UiIcon from './UiIcon.svelte';
 import { onMount } from 'svelte';
 import { stateBet, stateConfig } from 'state-shared';
 import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
 import { formatCurrency } from '../game/currency';
 import { initialBoard, betLevels as developmentBets, art } from './config';
 import { available, demo, replay, play, record, settle, validateWallet, bonusUnavailableReason } from './rgs';
 import { bonusConfig, isBonusMode, modeCost, modeWorld, variantTitle } from './bonus';
 import type { World, Wild, Reaction, Round, BookEvent, Mode, PurchaseQuote, PurchaseReceiptData, BonusVariant, LineWin } from './types';
 import WorldSelection from './WorldSelection.svelte';
 import CharacterStage from './CharacterStage.svelte';
 import ReelGrid from './ReelGrid.svelte';
 import FreeSpinsPresentation from './FreeSpinsPresentation.svelte';
 import FreeSpinsAward from './FreeSpinsAward.svelte';
 import PurchaseReceipt from './PurchaseReceipt.svelte';
 import WinPresentation from './WinPresentation.svelte';
 import BetControls from './BetControls.svelte';
 import GameSettings from './GameSettings.svelte';
 import BonusBuy from './BonusBuy.svelte';

 let world = $state<World>('BLOOM');
 let board = $state(initialBoard());
 let wilds = $state<Wild[]>([]);
 let busy = $state(true), moving = $state(false), feature = $state(false);
 let freeSpins = $state(0), freeSpinNumber = $state(0), featureWin = $state(0), win = $state(0);
 let awardedFreeSpins = $state(0);
 let finishFreeSpinsAward: (()=>void) | undefined;
 let reaction = $state<Reaction>('idle');
 let message = $state('A little magic is waiting.');
 let error = $state(''), blocked = $state(false), replayDone = $state(false);
 let winningLines = $state<LineWin[]>([]), activeWin = $state(0), lineStake = $state(1);
 let presentingLines = $state(false);
 let showWinningLines = $state(false);
 let finishLines: (()=>void) | undefined;
 let suppressLineClick = false;
 const selectedWin = $derived(winningLines[activeWin]);
 const highlights = $derived(showWinningLines ? selectedWin?.positions.map(p=>`${p.reel}:${p.row}`) ?? [] : []);
 const lineDetail = $derived(showWinningLines && selectedWin ? `Line ${selectedWin.meta.lineIndex} · ${money(lineStake*selectedWin.meta.winWithoutMult/100)} × ${selectedWin.meta.lineMultiplier} = ${money(lineStake*selectedWin.win/100)}${selectedWin.win<selectedWin.uncappedWin?' · capped':''}` : '');
 $effect(()=>{
  const count=winningLines.length;
  if(count<2 || moving || presentingLines || !showWinningLines) return;
  const timer=setInterval(()=>{activeWin=(activeWin+1)%count;},800);
  return ()=>clearInterval(timer);
 });
 let turbo = $state(false), reduced = $state(false), sound = $state(true);
 let auto = $state(0), sequence = 0;
 let panel = $state<'rules' | 'settings' | 'bonus' | null>(null);
 let receipt = $state<PurchaseReceiptData|null>(null);
 let reelGrid: { settle: () => Promise<void> } | undefined;
 let mounted = false;
 let elapsed = $state(0), netPosition = $state(0);
 let audio: AudioContext | undefined;
 let featureBase = 0;
 const abort = new AbortController();
 const betLevels = $derived(demo() ? developmentBets : stateConfig.betAmountOptions.filter(b => Number.isFinite(b) && b>0));
 const bet = $derived(stateBet.betAmount);
 const locked = $derived(busy || auto>0 || blocked || replay() || replayDone || !!panel);
 const validBet = $derived(Number.isFinite(bet) && bet>0 && (betLevels.length ? betLevels.includes(bet) : stateConfig.minBet>0 && stateConfig.stepBet>0 && bet>=stateConfig.minBet && bet<=stateConfig.maxBet && Math.abs(bet/stateConfig.stepBet-Math.round(bet/stateConfig.stepBet))<1e-9));
 const canSpin = $derived(!locked && available(world) && validBet && stateBet.balanceAmount >= bet);
 const canOpenBonus = $derived(!locked && validBet && !stateConfig.jurisdiction?.disabledBuyFeature);
 function money(n: number) { return formatCurrency(n,stateBet.currency || 'USD'); }
 const wait = (ms: number, actual = false) => new Promise<void>(resolve => {
  if (!mounted) return resolve();
  const done = () => { clearTimeout(timer); abort.signal.removeEventListener('abort',done); resolve(); };
  const timer = setTimeout(done,actual ? ms : reduced ? 0 : turbo ? Math.min(120,ms*.22) : ms);
  abort.signal.addEventListener('abort',done,{once:true});
 });
 function presentFreeSpinsAward(count: number) {
  if(!mounted)return Promise.resolve();
  awardedFreeSpins=count;
  return new Promise<void>(resolve=>{
   let finished=false;
   const done=()=>{
    if(finished)return;finished=true;
    clearTimeout(timer);abort.signal.removeEventListener('abort',done);
    finishFreeSpinsAward=undefined;awardedFreeSpins=0;resolve();
   };
   // Keep the award readable in Turbo and reduced-motion modes too.
   const timer=setTimeout(done,2200);
   finishFreeSpinsAward=done;abort.signal.addEventListener('abort',done,{once:true});
  });
 }
 function presentWinningLines() {
  if(!mounted || !showWinningLines || !winningLines.length || reduced) return Promise.resolve();
  presentingLines=true;activeWin=0;
  return new Promise<void>(resolve=>{
   const count=winningLines.length;
   const done=()=>{clearInterval(timer);abort.signal.removeEventListener('abort',done);finishLines=undefined;presentingLines=false;showWinningLines=false;resolve();};
   const timer=setInterval(()=>{if(activeWin+1>=count)done();else activeWin++;},800);
   finishLines=done;abort.signal.addEventListener('abort',done,{once:true});
  });
 }
 function dismissWinningLines() {
  if(!showWinningLines && !presentingLines)return false;
  showWinningLines=false;finishLines?.();return true;
 }
 function skipLinePointer(event: PointerEvent) {
  // A fresh gesture must not inherit suppression from a cancelled earlier tap.
  suppressLineClick=false;
  if(!dismissWinningLines())return;
  event.preventDefault();event.stopImmediatePropagation();suppressLineClick=true;
 }
 function skipLineClick(event: MouseEvent) {
  if(!suppressLineClick && !dismissWinningLines())return;
  suppressLineClick=false;event.preventDefault();event.stopImmediatePropagation();
 }
 function cancelLinePointer() {suppressLineClick=false;}
 function chime(kind: 'spin' | 'win' | 'wild') {
  if (!sound || !mounted || feature) return;
  audio ??= new AudioContext(); void audio.resume();
  const osc=audio.createOscillator(), gain=audio.createGain();
  osc.type=kind==='spin'?'triangle':'sine'; osc.frequency.value=kind==='win'?660:kind==='wild'?440:220;
  gain.gain.setValueAtTime(.025,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.25);
  osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.25);
 }
 function fail(e: unknown) { finishFreeSpinsAward?.();error=e instanceof Error?e.message:'The round could not be presented safely.'; blocked=true;busy=false;moving=false;auto=0; }
 function choose(next: World) { if (locked || !available(next)) return; world=next;stateBet.activeBetModeKey=next;board=initialBoard();wilds=[];win=0;receipt=null;winningLines=[];activeWin=0;showWinningLines=false;message='A little magic is waiting.';reaction='idle'; }
 function change(n: number) { if (locked) return; const i=betLevels.indexOf(bet); stateBet.betAmount=betLevels[Math.max(0,Math.min(betLevels.length-1,i+n))] ?? bet; }
 async function showEvent(e: BookEvent, stake: number, animate: boolean) {
  const amount=(v=0) => stake*v/100;
  if(e.type==='reveal') {
   reaction='spin';moving=true;
   if(animate&&!feature)chime('spin');
   if (!feature) wilds=[];
   winningLines=[];activeWin=0;showWinningLines=false;
   if(animate) await wait(feature?300:440);
   if(!mounted) return;
   board=e.board!;moving=false;
   if(animate) await reelGrid?.settle();
   if(!mounted) return;
   reaction=board.flat().filter(s=>s==='scatter').length>=2?'anticipation':'idle';
  } else if(e.type==='expandWilds') {
   reaction='wild'; if(animate) {chime('wild');await wait(240);}
   wilds=[...wilds.filter(w=>!e.wilds!.some(n=>n.reel===w.reel)),...e.wilds!]; if(animate)await wait(520);
  } else if(e.type==='stickyWildState') wilds=e.wilds!;
  else if(e.type==='winInfo') {
   winningLines=e.wins??[];activeWin=0;lineStake=stake;showWinningLines=winningLines.length>0;
  } else if(e.type==='setTotalWin') {
   win=amount(e.amount); if(feature)featureWin=win-featureBase;
   if(win/stake>=20 && !feature && animate){await presentWinningLines();if(!mounted)return;}
   if(e.amount!>0){reaction=win/stake>=20?'big':'win';message=win/stake>=20?'A wonderful windfall!':'Your magic is growing.';if(animate){if(reaction!=='big'||reduced)chime('win');await wait(340);}}
  } else if(e.type==='freeSpinTrigger'||e.type==='bonusStart') {
   const count=e.totalFs!;
   featureBase=win;feature=true;freeSpins=count;freeSpinNumber=0;featureWin=0;wilds=[];
   winningLines=[];activeWin=0;showWinningLines=false;
   reaction='intro';message=e.type==='bonusStart'?`${variantTitle(e.variant!)} · ${count} Free Spins`:`The petals awaken · ${count} Free Spins`;
   if(animate)await presentFreeSpinsAward(count);
  }
  else if(e.type==='updateFreeSpin') {freeSpinNumber=e.amount!;freeSpins=11-freeSpinNumber;message=`Free Spin ${freeSpinNumber} of 10`;}
  else if(e.type==='freeSpinEnd') {freeSpins=0;featureWin=amount(e.amount);reaction='ending';message='Your garden’s gift';if(animate)await wait(900);feature=false;}
  else if(e.type==='wincap') {message='5,000× · The garden’s greatest gift';reaction='big';}
  else if(e.type==='finalWin') {win=amount(e.amount);if(!win)message='Another petal, another possibility.';freeSpins=0;}
 }
 async function consume(round: Round, stake: number, recovering=false, expectedMode?:Mode) {
  const decoded=validateWallet(round,stake);
  if(!recovering && decoded.world!==world) throw new Error('Server world does not match the selected wager. Reload to recover.');
  if(expectedMode && decoded.mode!==expectedMode)throw new Error('Server mode does not match this purchase. Reload to recover.');
  if(expectedMode && decoded.costMultiplier!==modeCost(expectedMode))throw new Error('Server purchase price does not match the confirmed cost. Reload to recover.');
  world=decoded.world; stateBet.activeBetModeKey=decoded.mode;
  const receiptCurrency=stateBet.currency||'USD';
  receipt=isBonusMode(decoded.mode)?{world,bonus:variantTitle(bonusConfig[decoded.mode].variant as BonusVariant),multiplier:decoded.costMultiplier,currency:receiptCurrency,baseBet:formatCurrency(stake,receiptCurrency),paid:formatCurrency(stake*decoded.costMultiplier,receiptCurrency),win:null}:null;
  const cursor=round.event==null?-1:Number(round.event);
  if(!Number.isInteger(cursor) || cursor < -1 || cursor>=decoded.events.length)throw new Error('Invalid recovery cursor. Reload to recover this round.');
  feature=false;freeSpinNumber=0;wilds=[];win=0;featureWin=0;
  for(const e of decoded.events) {
   if(!mounted) return;
   const skip=recovering&&!replay()&&e.index<=cursor;
   await showEvent(e,stake,!skip);
   if(!mounted)return;
   if(!skip)await record(round,e.index);
  }
  if(!mounted)return;
  await settle(round);
  if(isBonusMode(decoded.mode)&&receipt)receipt={...receipt,win:formatCurrency(stake*decoded.payout/100,receipt.currency)};
  if(replay()){replayDone=true;message='Replay complete';}
 }
 async function run(mode:Mode=world) {
  const cost=modeCost(mode), purchaseMode=isBonusMode(mode);
  if(busy||blocked||replay()||replayDone||modeWorld(mode)!==world||!validBet||stateBet.balanceAmount<bet*cost)return false;
  if(purchaseMode ? (auto>0||Boolean(bonusUnavailableReason(mode))) : !available(world))return false;
  busy=true;error='';win=0;featureWin=0;winningLines=[];activeWin=0;showWinningLines=false;reaction='spin';moving=true;
  const stake=bet, started=Date.now();
  try {
   const round=await play(mode,stake,sequence++);
   validateWallet(round,stake);
   if(demo())stateBet.balanceAmount-=stake*cost;
   await consume(round,stake,false,mode);
   if(!mounted)return false;
   if(demo())stateBet.balanceAmount+=win;
   netPosition+=win-stake*cost;
   const minimum=Number(stateConfig.jurisdiction?.minimumRoundDuration)||0;
   const delay=minimum-(Date.now()-started);
   if(delay>0)await wait(delay,true);
   return true;
  }catch(e){fail(e);return false;}
  finally{if(mounted){busy=false;moving=false;reaction='idle';}}
 }
 async function spin(){if(canSpin)await run();}
 async function purchase(quote:PurchaseQuote){
  if(panel!=='bonus'||busy||blocked||auto>0||!validBet||quote.world!==world||quote.stake!==bet||quote.currency!==stateBet.currency||quote.costMultiplier!==modeCost(quote.mode)||quote.total!==bet*modeCost(quote.mode)||stateBet.balanceAmount<quote.total||bonusUnavailableReason(quote.mode))return;
  panel=null;
  await run(quote.mode);
 }
 async function toggleAuto(){
  if(auto){auto=0;return;}
  if(!canSpin||stateConfig.jurisdiction?.disabledAutoplay)return;
  auto=10;
  while(mounted&&auto>0&&!stateConfig.jurisdiction?.disabledAutoplay){
   const ok=await run();if(!ok)break;auto=Math.max(0,auto-1);if(auto)await wait(400);
  }
  auto=0;
 }
 function keydown(e: KeyboardEvent){
  if(e.defaultPrevented)return;
  if((e.code==='Space'||e.key==='Escape')&&dismissWinningLines()){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.key==='Escape'){if(panel!=='bonus')panel=null;auto=0;return;}
  if(e.code==='Space'&&!e.repeat&&!stateConfig.jurisdiction?.disabledSpacebar&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)){e.preventDefault();void spin();}
 }
 onMount(()=>{
  mounted=true;
  window.addEventListener('pointerdown',skipLinePointer,true);
  window.addEventListener('click',skipLineClick,true);
  window.addEventListener('pointercancel',cancelLinePointer,true);
  const media=matchMedia('(prefers-reduced-motion: reduce)');reduced=media.matches;
  const motion=()=>{reduced=media.matches;};media.addEventListener('change',motion);
  const timer=setInterval(()=>elapsed++,1000);
  if(demo()){stateBet.balanceAmount=1000;stateBet.betAmount=1;stateBet.currency='USD';}
  world=available('BLOOM')?'BLOOM':'BLIGHT';stateBet.activeBetModeKey=world;
  const resume=stateBet.betToResume;
  if(resume?.state){
   const round=resume as Round;
   const stake=Number(round.amount)/API_AMOUNT_MULTIPLIER;
   void consume(round,stake,true).then(()=>{if(mounted){stateBet.betToResume=null;busy=false;reaction='idle';}}).catch(fail);
  }else{busy=false;if(replay()){blocked=true;error='This replay has no authoritative round.';}}
  return()=>{mounted=false;auto=0;abort.abort();clearInterval(timer);media.removeEventListener('change',motion);window.removeEventListener('pointerdown',skipLinePointer,true);window.removeEventListener('click',skipLineClick,true);window.removeEventListener('pointercancel',cancelLinePointer,true);void audio?.close();};
 });
 $effect(()=>{if(stateConfig.jurisdiction?.disabledAutoplay)auto=0;if(stateConfig.jurisdiction?.disabledTurbo)turbo=false;if(stateConfig.jurisdiction?.disabledBuyFeature&&panel==='bonus')panel=null;});
</script>

<svelte:window onkeydown={keydown}/>
<main class="petal-world" class:blight={world==='BLIGHT'} class:reduced data-world={world} data-busy={busy} data-presenting-lines={presentingLines} style:--scene={`url('${art(world,'room')}')`}>
 <div class="scene-art"></div><div class="scene-shade"></div>
 <header class="petal-header"><div class="edition"><span class="edition-mark"><UiIcon name="flower" size={32}/></span><span>AN ENCHANTED<br/>TALE OF FORTUNE</span></div><div class="mini-brand">The Last Petal</div><div class="header-tools"><button onclick={()=>panel='rules'} aria-label="Open game rules"><UiIcon name="help" size={22}/></button><button onclick={()=>panel='settings'} aria-label="Open settings"><UiIcon name="settings" size={21}/></button></div></header>
 <section class="game-scene">
  <CharacterStage {world} {reaction} {moving} {feature} {reduced} {sound} winnings={money(win)} hasWin={win/bet>=20}/>
  <div class="slot-stage">
   <div class="title-lockup"><div><span class="eyebrow">TWO WORLDS. ONE LAST PETAL.</span><h1>The Last Petal</h1><p>{world==='BLOOM'?'Where a little kindness grows into magic.':'Where the last light meets the shadows.'}</p></div></div>
   <WorldSelection {world} {locked} {available} select={choose}/>
   <div class="board-wrap"><FreeSpinsPresentation active={feature} current={freeSpinNumber} remaining={freeSpins} total={money(featureWin)}/><ReelGrid bind:this={reelGrid} {turbo} {board} {world} spinning={moving} {wilds} sticky={feature} {highlights} line={showWinningLines ? selectedWin : undefined} {reduced}/></div>
   <div class="under-reels"><span class="world-description"><UiIcon name="flower" size={12}/><span>{world==='BLOOM'?'More frequent features · Gentler magic':'Rarer features · Greater volatility'}</span></span><WinPresentation win={money(win)} {message} big={win/bet>=20}/></div>
   <div class="round-details">
    <div class="line-detail" aria-live="polite" title={lineDetail}>{lineDetail}</div>
    <PurchaseReceipt {receipt}/>
   </div>
  </div>
 </section>
 {#if error}<div class="round-error" role="alert">{error}</div>{/if}
 <BetControls bet={money(bet)} balance={money(stateBet.balanceAmount)} {locked} {canSpin} {busy} {auto} {turbo} {canOpenBonus} openBonus={()=>panel='bonus'} autoAllowed={!stateConfig.jurisdiction?.disabledAutoplay&&!replay()} turboAllowed={!stateConfig.jurisdiction?.disabledTurbo&&!replay()} {change} spin={()=>void spin()} toggleAuto={()=>void toggleAuto()} toggleTurbo={()=>turbo=!turbo}/>
 <div class="game-footnote"><span>{demo()?'DEVELOPMENT DEMO · FIXED SHOWCASE BOOKS':replay()?'READ-ONLY REPLAY':'THE LAST PETAL'}</span><span>{stateConfig.jurisdiction?.displaySessionTimer?`Session ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`:'3 SCATTERS · 10 FREE SPINS'}{stateConfig.jurisdiction?.displayNetPosition?` · Net ${money(netPosition)}`:''}</span></div>
 {#if awardedFreeSpins>0}<FreeSpinsAward {world} count={awardedFreeSpins} {reduced} oncontinue={(stopAutoplay=false)=>{if(stopAutoplay)auto=0;finishFreeSpinsAward?.();}}/>{/if}
 {#if panel==='bonus'}<BonusBuy {world} stake={bet} currency={stateBet.currency} balance={stateBet.balanceAmount} format={money} reason={bonusUnavailableReason} close={()=>panel=null} {purchase}/>
 {:else if panel}<GameSettings {panel} {world} close={()=>panel=null} {reduced} setReduced={v=>reduced=v} {sound} setSound={v=>sound=v}/>{/if}
</main>
