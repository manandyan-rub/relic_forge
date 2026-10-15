import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
const origin=process.env.APP_ORIGIN??'http://localhost:3006';
const output=process.env.QA_OUTPUT??join(process.cwd(),'art','qa');mkdirSync(output,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if(!chrome)throw Error('No installed browser');
const port=9335;
const browser=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${join(tmpdir(),`petal-qa-${process.pid}`)}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore',windowsHide:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;
const results=[],errors=[];
const counts={authenticate:0,play:0,event:0,end:0,replay:0};
let modes=[],restricted=false,recovery=false,bad=false,recoveryMode='BLIGHT',historicPrice=null;
const fixtures=JSON.parse(readFileSync('src/petal/fixtures.json','utf8'));
const bonusFixtures=JSON.parse(readFileSync('src/petal/bonus-fixtures.json','utf8'));
const bonusConfig=JSON.parse(readFileSync('src/petal/bonus-config.json','utf8'));
try{
 let targets;for(let i=0;i<100;i++){try{targets=await(await fetch(`http://localhost:${port}/json/list`)).json();break;}catch{await delay(100);}}
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map(),handlers=new Map();
 socket.on('message',data=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}else for(const fn of handlers.get(m.method)??[])void fn(m.params);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const on=(event,fn)=>handlers.set(event,[...(handlers.get(event)??[]),fn]);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const check=(v,label)=>{if(!v)throw Error('FAIL '+label);results.push(label);};
 const wait=async(expression,label,timeout=20000)=>{const t=Date.now();while(Date.now()-t<timeout){if(await ev(expression))return;await delay(35);}throw Error(`Timeout ${label}: ${await ev('document.body.innerText')}`);};
 const click=selector=>ev(`document.querySelector(${JSON.stringify(selector)})?.click()`);
 const navigate=async url=>{await send('Page.navigate',{url});await wait("document.querySelector('.petal-world') || document.querySelector('.session-error')",'render');await delay(100);};
 const idle=()=>wait("document.querySelector('.petal-world')?.dataset.busy === 'false'",'round idle',60000);
 const shot=async name=>{const {data}=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,name+'.png'),Buffer.from(data,'base64'));};
 const media=reduce=>send('Emulation.setEmulatedMedia',{features:reduce?[{name:'prefers-reduced-motion',value:'reduce'}]:[]});
 const viewport=(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
 on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails.exception?.description??p.exceptionDetails.text));
 await Promise.all([send('Page.enable'),send('Runtime.enable'),send('Network.enable'),send('Fetch.enable',{patterns:[{urlPattern:'https://mock.local/*'}]})]);
 const makeRound=(mode='BLOOM',i=2)=>{
  const b=structuredClone(bonusFixtures[mode]?bonusFixtures[mode][0]:fixtures[mode][i]);
  if(historicPrice&&bonusFixtures[mode])b.events[0].purchaseCostMultiplier=historicPrice;
  if(bad)b.events[0].contract='old-forge';
  return{roundID:500+counts.play,amount:1000000,payout:b.payoutMultiplier*10000,payoutMultiplier:b.payoutMultiplier/100,mode,state:b.events,active:true,event:recovery?Math.floor(b.events.length/2):null};
 };
 on('Fetch.requestPaused',async p=>{
  const url=p.request.url,input=JSON.parse(p.request.postData??'{}');let body={};
  if(p.request.method==='OPTIONS')body={};
  else if(url.includes('authenticate')){
   counts.authenticate++;
   body={balance:{amount:1000000000,currency:'USD'},config:{minBet:200000,maxBet:50000000,stepBet:100000,defaultBetLevel:1000000,betLevels:[200000,500000,1000000,2000000],betModes:{BLOOM:{costMultiplier:1},BLIGHT:{costMultiplier:1},...Object.fromEntries(Object.entries(bonusConfig).map(([mode,c])=>[mode,{costMultiplier:c.costMultiplier,buyBonus:true}]))},jurisdiction:{disabledTurbo:restricted,disabledAutoplay:restricted,disabledSpacebar:restricted,disabledBuyFeature:restricted,minimumRoundDuration:0}},...(recovery?{round:makeRound(recoveryMode,4)}:{})};
  }else if(url.includes('/wallet/play')){counts.play++;modes.push(input.mode);body={balance:{amount:999000000,currency:'USD'},round:makeRound(input.mode)};}
  else if(url.includes('/bet/event')){counts.event++;body={event:String(input.event)};}
  else if(url.includes('end-round')){counts.end++;body={balance:{amount:1000200000,currency:'USD'}};}
  else if(url.includes('replay')){counts.replay++;const mode=url.split('/').at(-2);const b=bonusFixtures[mode]?bonusFixtures[mode][0]:fixtures.BLIGHT[2];body={...b,state:b.events,payoutMultiplier:b.payoutMultiplier/100};}
  await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Accept'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 });
 await navigate(origin+'/?demo=true');await idle();
 check(await ev("document.querySelectorAll('.reel-cell').length===25"),'5 by 5 board');
 check(await ev("document.title==='The Last Petal'"),'new branding');
 for(const [w,h,name] of [[1536,960,'bloom-desktop'],[768,1024,'bloom-tablet'],[390,844,'bloom-mobile'],[844,390,'bloom-landscape']]){
  await viewport(w,h);await delay(150);await wait("[...document.images].every(i=>i.complete)",'images loaded');
  check(await ev("[...document.images].filter(i=>i.closest('.petal-world')).every(i=>i.naturalWidth>0)"),name+' artwork loads');
  check(await ev('document.documentElement.scrollWidth<=innerWidth'),name+' no horizontal overflow');
  check(await ev("(()=>{const b=document.querySelector('.reel-window').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.width>=300})()"),name+' readable board');
  if(w>1000)check(await ev("document.querySelector('.bet-controls').getBoundingClientRect().bottom<=innerHeight"),name+' all controls visible');
  await shot(name);
 }
 // Character videos match each world; only big wins show amounts above the head.
 await viewport(2322,1267);await media(false);await navigate(origin+'/?demo=true');await idle();
 check(await ev("document.querySelector('.reel-window').getBoundingClientRect().width>=850"),'large desktop reels use available space');
 await shot('bloom-wide');
 for(const world of ['BLOOM','BLIGHT']){
  await navigate(origin+'/?demo=true');await idle();if(world==='BLIGHT')await click('.world-choice:nth-child(2)');
  await click('.spin-button');await delay(120);
  await wait("document.querySelector('.motion-active video[data-phase=spin]')?.readyState>=2",world+' spin restored');
  check(await ev(`document.querySelector('video').src.includes('${world==='BLOOM'?'bloom-traveler':'blight-keeper'}-spin')`),world+' correct character video');
  await idle();await click('.spin-button');await idle();
  check(await ev("!document.querySelector('.character-winnings')"),world+' small win stays below reels');
  await click('.spin-button');await wait("document.querySelector('.motion-active video.cinematic')?.readyState>=2",world+' full-screen big win');
  const fullscreen=await ev("(()=>{const v=document.querySelector('video.cinematic'),b=v.getBoundingClientRect();return {w:b.width,h:b.height,vw:document.body.getBoundingClientRect().width,vh:innerHeight,style:getComputedStyle(v).cssText}})()");check(Math.abs(fullscreen.w-fullscreen.vw)<1&&Math.abs(fullscreen.h-fullscreen.vh)<1,world+' big win covers viewport '+JSON.stringify(fullscreen));
  check(await ev("document.querySelector('.cinematic-win strong').textContent===document.querySelector('.win-presentation strong').textContent"),world+' big amount above head matches win');
  await shot(world.toLowerCase()+'-fullscreen-big-win');await click('[aria-label="Close big win animation"]');await idle();
 }
 // A Blight bonus keeps one video/audio pair through every free spin and pause.
 await viewport(1536,960);await media(false);await navigate(origin+'/?demo=true');await idle();
 await click('.world-choice:nth-child(2)');await click('[aria-label="Toggle turbo"]');
 await click('[aria-label="Open Bonus Buy"]');await click('[aria-label="Select STANDARD bonus"]');
 const confirm=await ev("(()=>{const b=document.querySelector('[aria-label=\"Confirm bonus purchase\"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...confirm,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...confirm,button:'left',clickCount:1});
 await wait("document.querySelector('.free-spins-banner')&&document.querySelector('video')?.readyState>=2&&!document.querySelector('audio')?.paused",'Blight continuous feature media');
 await ev(`(()=>{const video=document.querySelector('video'),audio=document.querySelector('audio');window.__featureMedia={samples:0,changes:0,paused:0,between:0,counts:[]};const sample=()=>{const b=document.querySelector('.free-spins-banner'),m=window.__featureMedia;if(b){m.samples++;if(document.querySelector('video')!==video||document.querySelector('audio')!==audio)m.changes++;if(video.paused||audio.paused)m.paused++;if(!document.querySelector('.reel-spin-track'))m.between++;const count=b.querySelector('strong').textContent;if(!m.counts.includes(count))m.counts.push(count);}window.__featureMediaRaf=requestAnimationFrame(sample)};sample()})()`);
 await idle();
 const continuous=await ev("(()=>{cancelAnimationFrame(window.__featureMediaRaf);return window.__featureMedia})()");
 check(continuous.samples>30&&continuous.between>0&&continuous.counts.length>=10,'Blight media observed across all ten free spins and pauses');
 check(continuous.changes===0&&continuous.paused===0,'Blight keeps the same playing video and soundtrack throughout the feature');
 check(await ev("!document.querySelector('audio')&&!document.querySelector('video')"),'Blight feature media stops after completion');
 // Observe layout throughout real motion, wins and a purchased sticky feature.
 for(const [w,h] of [[1536,960],[768,1024],[390,844],[844,390]]){
  await viewport(w,h);await media(false);await navigate(origin+'/?demo=true');await idle();
  await wait("[...document.images].every(i=>i.complete&&i.naturalWidth>0)",'motion-test artwork');
  await click('[aria-label="Toggle turbo"]');
  await ev(`(()=>{scrollTo(0,Math.min(80,document.documentElement.scrollHeight-innerHeight));window.__layoutSamples=[];const sample=()=>{const b=document.querySelector('.reel-cabinet').getBoundingClientRect(),c=document.querySelector('.bet-controls').getBoundingClientRect();window.__layoutSamples.push([b.top+scrollY,b.height,c.top+scrollY,c.height,document.documentElement.scrollHeight,scrollY]);window.__layoutRaf=requestAnimationFrame(sample)};sample()})()`);
  for(let i=0;i<3;i++){await click('.spin-button');await idle();}
  await click('[aria-label="Open Bonus Buy"]');await click('[aria-label="Select STANDARD bonus"]');await click('[aria-label="Confirm bonus purchase"]');await idle();
  const geometry=await ev(`(()=>{cancelAnimationFrame(window.__layoutRaf);const a=window.__layoutSamples;return {samples:a.length,ranges:a[0].map((_,i)=>Math.max(...a.map(s=>s[i]))-Math.min(...a.map(s=>s[i]))),error:document.querySelector('.round-error')?.textContent}})()`);
  check(!geometry.error&&geometry.samples>20,`${w}x${h} samples wins, expansion and purchased feature`);
  check(geometry.ranges.every(n=>n<=1),`${w}x${h} board, controls, document height and scroll stay fixed`);
 }
 // Compare the seam immediately before and after one exact strip cycle.
 await viewport(1536,960);await media(false);await navigate(origin+'/?demo=true');await idle();
 await click('.spin-button');await wait("Boolean(document.querySelector('.reel-spin-track'))",'continuous strip');
 const seam=await ev(`(()=>{const t=document.querySelector('.reel-spin-track'),v=t.parentElement,a=t.getAnimations()[0];a.pause();const frame=ms=>{a.currentTime=ms;const box=v.getBoundingClientRect();return [...t.children].map(c=>{const b=c.getBoundingClientRect();return {label:c.querySelector('.symbol').getAttribute('aria-label'),y:(b.top+b.bottom)/2-box.top}}).filter(c=>c.y>0&&c.y<box.height)};const before=frame(479.99),after=frame(.01);a.play();return {before,after}})()`);
 check(seam.before.length===5&&seam.after.length===5&&seam.before.every((s,i)=>s.label===seam.after[i].label&&Math.abs(s.y-seam.after[i].y)<.1),'reel wrap has matching symbols and subpixel-continuous positions');
 await idle();
 await viewport(1536,960);await media(true);
 for(const world of ['BLOOM','BLIGHT']){
  await navigate(origin+'/?demo=true');await idle();if(world==='BLIGHT')await click('.world-choice:nth-child(2)');
  for(let i=0;i<7;i++){await click('.spin-button');await idle();check(!(await ev("Boolean(document.querySelector('.round-error'))")),world+` base fixture ${i+1} reconciles`);if(i===2)check(await ev("document.querySelectorAll('.expanded-wild').length===1"),world+' expanding reel');if(i===3)check(await ev("document.querySelectorAll('.expanded-wild').length===2"),world+' multiple expanded reels');}
  check(await ev("document.querySelector('.win-presentation strong').textContent.includes('5,000')"),world+' cap displayed');
 }
 await navigate(origin+'/?demo=true');await idle();await click('[aria-label="Start 10 autoplay spins"]');await wait("document.querySelector('[aria-label=\"Stop autoplay\"]')",'auto starts');await click('[aria-label="Stop autoplay"]');await idle();check(await ev("Boolean(document.querySelector('[aria-label=\"Start 10 autoplay spins\"]'))"),'autoplay stops');
 await click('[aria-label="Open game rules"]');check(await ev("document.querySelectorAll('tbody tr').length===8"),'paytable remains available');await click('[aria-label="Close dialog"]');
 // Every purchase starts from a fresh deterministic wallet and the minimum base bet.
 for(const [mode,c] of Object.entries(bonusConfig)){
  await navigate(origin+'/?demo=true');await idle();if(c.world==='BLIGHT')await click('.world-choice:nth-child(2)');
  await click('[aria-label="Open Bonus Buy"]');
  check(await ev("document.querySelectorAll('.bonus-card').length===3"),mode+' three offers');
  check(await ev(`document.querySelector('.bonus-panel').dataset.bonusWorld===${JSON.stringify(c.world)}`),mode+' world theme');
  if(c.costMultiplier>1000)check(await ev(`document.querySelector('[data-bonus-mode="${mode}"] .bonus-select').disabled`),mode+' insufficient funds lock');
  await click('[aria-label="Close Bonus Buy"]');await click('[aria-label="Decrease bet"]');await click('[aria-label="Decrease bet"]');
  await click('[aria-label="Open Bonus Buy"]');const expectedCost=.2*c.costMultiplier;
  const beforeBalance=await ev("document.querySelector('.wallet strong').textContent");
  await click(`[aria-label="Select ${c.variant} bonus"]`);
  check(await ev("Boolean(document.querySelector('.purchase-confirmation'))"),mode+' explicit confirmation');
  check(await ev(`document.querySelector('.purchase-total dd').textContent.replace(/[^0-9.]/g,'')===${JSON.stringify(expectedCost.toFixed(2))}`),mode+' full cost');
  check((await ev("document.querySelector('.wallet strong').textContent"))===beforeBalance,mode+' selection does not charge');
  await click('[aria-label="Close Bonus Buy"]');check((await ev("document.querySelector('.wallet strong').textContent"))===beforeBalance,mode+' cancel does not charge');
  await click('[aria-label="Open Bonus Buy"]');await wait("[...document.querySelectorAll('.bonus-card img')].every(i=>i.complete&&i.naturalWidth>0)",'bonus artwork');
  if(c.variant==='STANDARD')await shot(c.world.toLowerCase()+'-bonus-desktop');
  await click(`[aria-label="Select ${c.variant} bonus"]`);
  await ev("(()=>{const b=document.querySelector('[aria-label=\"Confirm bonus purchase\"]');b.click();b.click();})()");await idle();
  check(!(await ev("Boolean(document.querySelector('.round-error'))")),mode+' feature reconciles');
  const expectedBalance=1000-expectedCost+.2*bonusFixtures[mode][0].payoutMultiplier/100;
  const balance=await ev("Number(document.querySelector('.wallet strong').textContent.replace(/[^0-9.]/g,''))");
  check(Math.abs(balance-expectedBalance)<.011,mode+' one debit and one payout after double click');
  check(await ev(`document.querySelector('.purchase-receipt').textContent.includes(${JSON.stringify(c.world)})&&document.querySelector('.purchase-receipt').textContent.includes(${JSON.stringify(c.costMultiplier+'×')})`),mode+' original price receipt');
 }
 await navigate(origin+'/?demo=true');await idle();await viewport(390,844);await click('[aria-label="Open Bonus Buy"]');
 check(await ev("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.bonus-panel').getBoundingClientRect().right<=innerWidth"),'mobile Bonus Buy fits');await shot('bloom-bonus-mobile');await click('[aria-label="Close Bonus Buy"]');await viewport(1536,960);
 await navigate(origin+'/');check(await ev("Boolean(document.querySelector('.session-error'))"),'explicit demo required');
 await navigate(origin+'/?demo=true&sessionID=partial');check(await ev("Boolean(document.querySelector('.session-error'))"),'partial credentials cannot enter demo');
 const live=origin+'/?sessionID=test-session&rgs_url=mock.local';
 await navigate(live);await idle();await click('.world-choice:nth-child(2)');await click('.spin-button');await idle();
 check(modes.at(-1)==='BLIGHT','base mode sent unchanged');check(counts.play===1&&counts.end===1&&counts.event>0,'base play and settlement once');
 check(await ev("document.querySelector('.wallet strong').textContent.includes('1,000.20')"),'authoritative settled balance');
 recovery=true;const before=counts.play;await navigate(live);await idle();check(counts.play===before,'base recovery never wagers');check(!(await ev("Boolean(document.querySelector('.round-error'))")),'base feature recovery succeeds');
 recoveryMode='BLOOM_MYTHIC_BONUS';historicPrice=611;const beforePurchaseRecovery={...counts};await navigate(live);await idle();
 check(counts.play===beforePurchaseRecovery.play&&counts.end===beforePurchaseRecovery.end+1,'purchased recovery settles without buying again');
 check(await ev("document.querySelector('.purchase-receipt')?.textContent.includes('Mythic Bonus')&&!document.querySelector('.round-error')"),'purchase recovery restores variant and full cost');
 check(await ev("document.querySelector('.purchase-receipt').textContent.includes('611×')"),'recovery uses original book price rather than current catalog');
 recovery=false;historicPrice=null;recoveryMode='BLIGHT';await navigate(live);await idle();await click('[aria-label="Open Bonus Buy"]');
 check(await ev("[...document.querySelectorAll('.bonus-select')].every(b=>b.disabled)"),'connected purchase buttons locked despite advertised modes');
 const beforeBlocked=counts.play;
 const blocked=await ev("(async()=>{const {play}=await import('/src/petal/rgs.ts');try{await play('BLOOM_STANDARD_BONUS',1,999);return false}catch{return true}})()");
 check(blocked&&counts.play===beforeBlocked,'transport rejects unapproved connected purchase');await click('[aria-label="Close Bonus Buy"]');
 restricted=true;await navigate(live);await idle();
 check(await ev("document.querySelector('[aria-label=\"Toggle turbo\"]').disabled&&document.querySelector('[aria-label=\"Start 10 autoplay spins\"]').disabled&&document.querySelector('[aria-label=\"Open Bonus Buy\"]').disabled"),'jurisdiction blocks Turbo, autoplay and Bonus Buy');
 const beforeSpace=counts.play;await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await delay(100);check(counts.play===beforeSpace,'jurisdiction blocks Space');restricted=false;
 bad=true;await navigate(live);await idle();await click('.spin-button');await idle();check(await ev("Boolean(document.querySelector('.round-error'))&&document.querySelector('.spin-button').disabled"),'unsupported live book locks wagering');const afterBad=counts.play;await click('.spin-button');check(counts.play===afterBad,'invalid book never falls back to demo');bad=false;
 for(const mode of ['BLIGHT','BLIGHT_SUPER_BONUS']){
  const snapshot={...counts};await navigate(origin+`/?replay=true&rgs_url=mock.local&game=relic_forge&version=1&mode=${mode}&event=0&amount=200000`);await idle();
  check(counts.play===snapshot.play&&counts.event===snapshot.event&&counts.end===snapshot.end&&counts.replay===snapshot.replay+1,mode+' replay has no wallet writes');
  check(await ev("document.querySelector('.spin-button').disabled&&document.querySelector('[aria-label=\"Open Bonus Buy\"]').disabled"),mode+' replay disables purchases');
  if(mode.includes('BONUS'))check(await ev("document.querySelector('.purchase-receipt')?.textContent.includes('Super Bonus')"),'bonus replay preserves full price and variant');
 }
 check(await ev("document.querySelector('main').classList.contains('reduced')"),'reduced motion honored');
 const decoded=await ev(`(async()=>{const {decodeRound}=await import('/src/petal/MathEventAdapter.ts');const base=(await import('/src/petal/fixtures.json')).default;const bonus=(await import('/src/petal/bonus-fixtures.json')).default;let passed=0;for(const [mode,books] of Object.entries({...base,...bonus}))for(const b of books){decodeRound({mode,state:b.events,payoutMultiplier:b.payoutMultiplier/100});passed++;}let rejected=0;for(const mode of ['BLOOM_SUPER_BONUS','BLOOM_MYTHIC_BONUS']){const b=structuredClone(bonus[mode][0]);b.events.find(e=>e.type==='expandWilds').wilds=[];try{decodeRound({mode,state:b.events})}catch{rejected++}}return{passed,rejected}})()`);
 check(decoded.passed===32&&decoded.rejected===2,'32 Python fixtures decode; missing purchase guarantees reject');
 check(errors.length===0,'no browser runtime exceptions');
 const report={passed:results,counts,modes,errors};console.log(JSON.stringify(report,null,2));writeFileSync(join(output,'browser-results.json'),JSON.stringify(report,null,2));
}catch(e){writeFileSync(join(output,'browser-failure.txt'),String(e));throw e;}finally{socket?.close();browser.kill();}
