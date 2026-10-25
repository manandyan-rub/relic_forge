import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
const origin=process.env.APP_ORIGIN??'http://localhost:3006';
const output=process.env.QA_OUTPUT??join(process.cwd(),'art','qa');mkdirSync(output,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if(!chrome)throw Error('No installed browser');
const profile=mkdtempSync(join(tmpdir(),'petal-qa-'));
const browser=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore',windowsHide:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;
const results=[],errors=[],retiredBigMediaRequests=[];
const counts={authenticate:0,play:0,event:0,end:0,replay:0};
let modes=[],restricted=false,recovery=false,bad=false,recoveryMode='BLIGHT',historicPrice=null;
let identityKind='numeric',completedRecovery=false;
let holdWinInfo=false,releaseWinInfo;
let playBookIndex=2,holdPlayAt=-1,releasePlay;
const fixtures=JSON.parse(readFileSync('src/petal/fixtures.json','utf8'));
const bonusFixtures=JSON.parse(readFileSync('src/petal/bonus-fixtures.json','utf8'));
const bonusConfig=JSON.parse(readFileSync('src/petal/bonus-config.json','utf8'));
try{
 let targets,port;for(let i=0;i<100;i++){try{[port]=readFileSync(join(profile,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);if(!/^\d+$/.test(port))throw Error('Invalid spawned browser port');targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(t=>t.type==='page'))break;}catch{}await delay(100);}
 const target=targets?.find(t=>t.type==='page');if(!target||new URL(target.webSocketDebuggerUrl).port!==port)throw Error('Spawned browser did not expose its own page');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise(r=>socket.once('open',r));
 let id=0;const pending=new Map(),handlers=new Map();
 socket.on('message',data=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}else for(const fn of handlers.get(m.method)??[])void fn(m.params);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const on=(event,fn)=>handlers.set(event,[...(handlers.get(event)??[]),fn]);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const check=(v,label)=>{if(!v)throw Error('FAIL '+label);results.push(label);};
 const wait=async(expression,label,timeout=20000)=>{const t=Date.now();while(Date.now()-t<timeout){if(await ev(expression))return;await delay(35);}throw Error(`Timeout ${label}: ${await ev('document.body.innerText')}`);};
 // Dismiss and activate within one turn so a new win cannot race the action helper.
 // Explicit dismissal regressions below use raw input so consumption is still tested.
 const click=selector=>ev(`(()=>{if(document.querySelector('.winning-payline'))document.querySelector('.title-lockup h1').click();document.querySelector(${JSON.stringify(selector)})?.click()})()`);
 const navigate=async url=>{const previous=await ev('window.__qaDocumentId');await send('Page.navigate',{url});await wait(`window.__qaDocumentId&&window.__qaDocumentId!==${JSON.stringify(previous)}`,'fresh document');await wait("document.querySelector('.petal-world') || document.querySelector('.session-error')",'render');await delay(100);};
 const idle=()=>wait("document.querySelector('.petal-world')?.dataset.busy === 'false'",'round idle',60000);
 const shot=async name=>{const {data}=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,name+'.png'),Buffer.from(data,'base64'));};
 const media=async reduce=>{await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]});await wait(`matchMedia('(prefers-reduced-motion: reduce)').matches===${reduce}`,'system motion preference applied');await delay(80);};
 const viewport=(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
 on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails.exception?.description??p.exceptionDetails.text));
 on('Network.requestWillBeSent',p=>{if(/\/(?:bloom-traveler|blight-keeper)-big(?:\.webm|\.mp3|-poster\.webp)(?:[?#]|$)/.test(p.request.url))retiredBigMediaRequests.push(p.request.url);});
 await Promise.all([send('Page.enable'),send('Runtime.enable'),send('Network.enable'),send('Fetch.enable',{patterns:[{urlPattern:'https://mock.local/*'}]})]);
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__qaDocumentId=crypto.randomUUID()'});
 const makeRound=(mode='BLOOM',i=2)=>{
  const b=structuredClone(bonusFixtures[mode]?bonusFixtures[mode][0]:fixtures[mode][i]);
  if(historicPrice&&bonusFixtures[mode])b.events[0].purchaseCostMultiplier=historicPrice;
  if(bad)b.events[0].contract='old-forge';
  return{...(identityKind==='numeric'?{roundID:500+counts.play}:identityKind==='betID'?{betID:'same-bet-id'}:identityKind==='opaque'?{roundID:'same-opaque-id'}:{}),amount:1000000,payout:b.payoutMultiplier*10000,payoutMultiplier:b.payoutMultiplier/100,mode,state:b.events,active:!completedRecovery,event:recovery?Math.floor(b.events.length/2):null};
 };
 on('Fetch.requestPaused',async p=>{
  const url=p.request.url,input=JSON.parse(p.request.postData??'{}');let body={};
  if(p.request.method==='OPTIONS')body={};
  else if(url.includes('authenticate')){
   counts.authenticate++;
   body={balance:{amount:1000000000,currency:'USD'},config:{minBet:200000,maxBet:50000000,stepBet:100000,defaultBetLevel:1000000,betLevels:[200000,500000,1000000,2000000],betModes:{BLOOM:{costMultiplier:1},BLIGHT:{costMultiplier:1},...Object.fromEntries(Object.entries(bonusConfig).map(([mode,c])=>[mode,{costMultiplier:c.costMultiplier,buyBonus:true}]))},jurisdiction:{disabledTurbo:restricted,disabledAutoplay:restricted,disabledSpacebar:restricted,disabledBuyFeature:restricted,minimumRoundDuration:0}},...(recovery?{round:makeRound(recoveryMode,4)}:{})};
  }else if(url.includes('/wallet/play')){counts.play++;modes.push(input.mode);body={balance:{amount:999000000,currency:'USD'},round:makeRound(input.mode,playBookIndex)};if(counts.play===holdPlayAt)await new Promise(resolve=>{releasePlay=resolve;});}
  else if(url.includes('/bet/event')){counts.event++;body={event:String(input.event)};if(holdWinInfo&&Number(input.event)===fixtures.BLOOM[2].events.find(e=>e.type==='winInfo').index)await new Promise(resolve=>{releaseWinInfo=resolve;});}
  else if(url.includes('end-round')){counts.end++;body={balance:{amount:1000200000,currency:'USD'}};}
  else if(url.includes('replay')){counts.replay++;const mode=url.split('/').at(-2);const b=bonusFixtures[mode]?bonusFixtures[mode][0]:fixtures.BLIGHT[2];body={...b,state:b.events,payoutMultiplier:b.payoutMultiplier/100};}
  await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Accept'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 });
 await navigate(origin+'/?demo=true');await idle();
 await ev('document.fonts.ready');

 check(await ev("![...document.querySelectorAll('link')].some(l=>/fonts\\.(googleapis|gstatic)\\.com/.test(l.href))"),'fonts have no external stylesheet or preconnect dependency');
 await ev(`document.fonts.load('400 14px "Google Sans"','Magic')`);
 check(await ev(`(()=>{const family=f=>f.family.replaceAll('"','').replaceAll("'",'');return [...document.fonts].some(f=>family(f)==='Google Sans'&&f.style==='normal'&&f.status==='loaded')&&getComputedStyle(document.body).fontFamily.split(',')[0].replaceAll('"','').replaceAll("'",'').trim()==='Google Sans'&&getComputedStyle(document.documentElement).fontOpticalSizing==='auto'})()`),'bundled Google Sans loads as the primary face with optical sizing '+JSON.stringify(await ev("({faces:[...document.fonts].map(f=>({family:f.family,style:f.style,status:f.status})),body:getComputedStyle(document.body).fontFamily,optical:getComputedStyle(document.documentElement).fontOpticalSizing})")));
 await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.setBlockedURLs',{urls:['*://fonts.googleapis.com/*','*://fonts.gstatic.com/*']});await viewport(390,844);await navigate(origin+'/?demo=true');await idle();await ev('document.fonts.ready');
 check(await ev(`(()=>{const family=f=>f.family.replaceAll('"','').replaceAll("'",'');return [...document.fonts].some(f=>family(f)==='Google Sans'&&f.status==='loaded')&&document.documentElement.scrollWidth<=innerWidth})()`),'bundled font renders with external font origins blocked and without mobile overflow');
 await send('Network.setBlockedURLs',{urls:[]});await viewport(1536,960);await navigate(origin+'/?demo=true');await idle();await ev('document.fonts.ready');await send('Network.setCacheDisabled',{cacheDisabled:false});
 const wrongFonts=await ev(`[...document.querySelectorAll('.petal-world *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!getComputedStyle(e).fontFamily.includes('Google Sans')).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,80),font:getComputedStyle(e).fontFamily}))`);
 check(wrongFonts.length===0,'all game text uses Google Sans '+JSON.stringify(wrongFonts));
 check(await ev("document.querySelectorAll('.reel-cell').length===25"),'5 by 5 board');
 check(await ev("document.title==='The Last Petal'"),'new branding');
 check(await ev("!document.querySelector('.title-lockup img')"),'round title logo removed');
 for(const [w,h,name] of [[1536,960,'bloom-desktop'],[1366,768,'bloom-laptop'],[1024,650,'bloom-short-desktop'],[1024,651,'bloom-desktop-breakpoint'],[768,1024,'bloom-tablet'],[390,844,'bloom-mobile'],[320,568,'bloom-small-mobile'],[844,390,'bloom-landscape'],[568,320,'bloom-small-landscape']]){
  await viewport(w,h);await delay(150);await wait("[...document.images].every(i=>i.complete)",'images loaded');
  check(await ev("[...document.images].filter(i=>i.closest('.petal-world')).every(i=>i.naturalWidth>0)"),name+' artwork loads');
  check(await ev('document.documentElement.scrollWidth<=innerWidth'),name+' no horizontal overflow');
  check(await ev("(()=>{const p=document.querySelector('.bet-controls').getBoundingClientRect();return [...document.querySelectorAll('.bet-controls button')].every(e=>{const b=e.getBoundingClientRect();return b.left>=p.left&&b.right<=p.right})})()"),name+' every control stays inside the deck');
  check(await ev("(()=>{const b=document.querySelector('.reel-window').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.width>=Math.min(300,innerWidth-48)})()"),name+' readable board');
  if(w>1000&&h>=700)check(await ev("document.querySelector('.bet-controls').getBoundingClientRect().bottom<=innerHeight"),name+' all controls visible '+JSON.stringify(await ev("({viewport:[innerWidth,innerHeight],body:document.body.scrollHeight,main:document.querySelector('main').getBoundingClientRect().toJSON(),scene:document.querySelector('.game-scene').getBoundingClientRect().toJSON(),reels:document.querySelector('.reel-window').getBoundingClientRect().toJSON(),controls:document.querySelector('.bet-controls').getBoundingClientRect().toJSON()})")));
  if(w>700)check(await ev("(()=>{const b=document.querySelector('.bet-controls').getBoundingClientRect(),s=document.querySelector('.spin-button').getBoundingClientRect();return Math.abs((s.left+s.right-b.left-b.right)/2)<1})()"),name+' Spin centered in bottom bar');
  check(await ev("[...document.querySelectorAll('.secondary-control svg')].every(i=>{const p=i.parentElement,b=p.getBoundingClientRect(),a=getComputedStyle(p).flexDirection==='row'?[...p.children].reduce((r,c)=>{const x=c.getBoundingClientRect();return {left:Math.min(r.left,x.left),right:Math.max(r.right,x.right)}},{left:Infinity,right:-Infinity}):i.getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<1})"),name+' control icons centered in buttons');
  check(await ev("(()=>{const a=document.querySelector('.win-presentation').getBoundingClientRect(),b=document.querySelector('.under-reels').getBoundingClientRect();return Math.abs((a.left+a.right-b.left-b.right)/2)<1})()"),name+' win display centered below reels');

  check(await ev("[...document.querySelectorAll('.world-choice')].every(b=>{const a=b.children[1].getBoundingClientRect(),p=b.getBoundingClientRect();return Math.abs((a.left+a.right-p.left-p.right)/2)<1})"),name+' world labels centered inside cards');
  check(await ev("[...document.querySelectorAll('.header-tools button,.bet-picker button')].every(b=>{const i=b.querySelector('svg'),a=i.getBoundingClientRect(),p=b.getBoundingClientRect();return Math.abs((a.left+a.right-p.left-p.right)/2)<1&&Math.abs((a.top+a.bottom-p.top-p.bottom)/2)<1})"),name+' header and bet icons centered on both axes');
  check(await ev("(()=>{const a=document.querySelector('.bonus-buy-button'),b=a.getBoundingClientRect(),x=[...a.children].map(c=>c.getBoundingClientRect());return Math.abs((Math.min(...x.map(p=>p.left))+Math.max(...x.map(p=>p.right))-b.left-b.right)/2)<1&&x.every(p=>Math.abs((p.top+p.bottom-b.top-b.bottom)/2)<1)})()"),name+' bonus icon and label centered as a group');
  check(await ev("[...document.querySelectorAll('svg.ui-icon')].every(i=>{const b=i.getBBox();return Math.abs(b.x+b.width/2-12)<.5&&Math.abs(b.y+b.height/2-12)<.5})"),name+' visible icon paths centered within viewboxes');
  check(await ev("(()=>{const p=document.querySelector('.under-reels').getBoundingClientRect();return [...document.querySelectorAll('.world-description,.win-presentation small,.win-presentation strong')].every(e=>{const b=e.getBoundingClientRect();return b.top>=p.top&&b.bottom<=p.bottom})})()"),name+' result text rows fit without clipping');
  if(name==='bloom-desktop')writeFileSync(join(output,'icon-metrics.json'),JSON.stringify(await ev("[...document.querySelectorAll('svg.ui-icon')].map(i=>{const b=i.getBBox();return {name:i.dataset.icon,centerX:b.x+b.width/2,centerY:b.y+b.height/2}})"),null,2));
  check(await ev("(()=>{const footer=document.querySelector('.cabinet-bottom'),f=footer.getBoundingClientRect(),c=[...footer.children].map(e=>e.getBoundingClientRect());return Math.abs((c[0].left+c[2].right-f.left-f.right)/2)<1&&c.every((e,i)=>Math.abs((e.top+e.bottom-f.top-f.bottom)/2+(parseFloat(getComputedStyle(footer.children[i]).marginBottom)||0)/2)<1)&&getComputedStyle(footer.firstElementChild).justifyContent==='center'&&getComputedStyle(footer.lastElementChild).justifyContent==='center'})()"),name+' reel footer captions centered with equal bottom margins');
  await shot(name);
  if(name==='bloom-mobile'){await ev("document.querySelector('.bet-controls').scrollIntoView({block:'center'})");await shot('bloom-mobile-controls');await ev('scrollTo(0,0)');}
 }
 // Short landscape dialogs keep readable copy and a reachable close control.
 await viewport(568,320);
 for(const [open,close,name] of [['Open game rules','Close dialog','rules'],['Open settings','Close dialog','settings'],['Open Bonus Buy','Close Bonus Buy','Bonus Buy']]){
  await click(`[aria-label="${open}"]`);await wait("Boolean(document.querySelector('.modal-scrim [role=dialog]'))",name+' dialog opens');
  check(await ev("(()=>{const d=document.querySelector('.modal-scrim [role=dialog]'),b=d.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()"),'short landscape '+name+' fits and scrolls inside the viewport');
  check(await ev("(()=>{const b=document.querySelector('.modal-close').getBoundingClientRect();return b.width>=44&&b.height>=44&&b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight})()"),'short landscape '+name+' has a visible 44px close control');
  check(await ev("(()=>{const p=[...document.querySelectorAll('.modal-scrim p')];return p.length>0&&p.every(e=>parseFloat(getComputedStyle(e).fontSize)>=12)})()"),'short landscape '+name+' body text stays at least 12px');
  await click(`[aria-label="${close}"]`);
 }
 // Big wins count the authoritative payout without loading character cinematics.
 await viewport(2322,1267);await media(false);await navigate(origin+'/?demo=true');await idle();
 check(await ev("document.querySelector('.reel-window').getBoundingClientRect().width>=850"),'large desktop reels use available space');
 await shot('bloom-wide');
 for(const world of ['BLOOM','BLIGHT']){
  await navigate(origin+'/?demo=true');await idle();if(world==='BLIGHT')await click('.world-choice:nth-child(2)');
  await click('.spin-button');await delay(120);
  check(await ev("!document.querySelector('video,audio')"),world+' base spins use still character without clip audio');
  await idle();await click('.spin-button');await idle();
  check(await ev("!document.querySelector('.character-winnings')"),world+' small win stays below reels');
  await click('.spin-button');
  await wait("document.querySelector('main').dataset.presentingLines==='true'",world+' lines before big win');
  check(await ev("!document.querySelector('dialog.big-win-count,video.cinematic')&&document.querySelector('.spin-button').disabled&&Boolean(document.querySelector('.winning-payline'))"),world+' lines show first while wagers stay locked');
  if(world==='BLIGHT'){
   const target=await ev("(()=>{const b=document.querySelector('[aria-label=\"Open game rules\"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...target,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});
   await wait("document.querySelector('main').dataset.presentingLines==='false'",world+' click skips line presentation',700);
   check(await ev("!document.querySelector('.winning-payline')&&!document.querySelector('.reel-cell.winning')"),world+' skip immediately removes lines and highlights');
   check(await ev("!document.querySelector('.petal-modal')"),world+' skip click does not activate underlying controls');
  }else{
   await ev("window.__shownLines=[];window.__lineWatch=setInterval(()=>{const n=document.querySelector('.winning-payline')?.dataset.line;if(n&&!window.__shownLines.includes(n))window.__shownLines.push(n)},50)");
  }
  await wait("document.querySelector('dialog.big-win-count[open]')?.dataset.counting==='true'",world+' full-screen big-win count');
  if(world==='BLOOM')check(await ev("(()=>{clearInterval(window.__lineWatch);return window.__shownLines.length===3})()"),world+' all three winning lines finish before counting');
  check(await ev("!document.querySelector('video,audio,.character-winnings')&&document.querySelector('main').dataset.busy==='true'&&document.querySelector('.spin-button').disabled"),world+' counter replaces the cinematic and keeps wagers locked');
  check(await ev("document.querySelector('.count-target').textContent===document.querySelector('.win-presentation strong').textContent"),world+' count target matches the authoritative win');
  await shot(world.toLowerCase()+'-big-win-count');
  await viewport(390,844);
  check(await ev("(()=>{const d=document.querySelector('dialog.big-win-count'),v=document.querySelector('.count-value').getBoundingClientRect(),b=document.querySelector('.count-continue').getBoundingClientRect();return d.open&&v.left>=0&&v.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&!document.querySelector('.winning-payline')})()"),world+' mobile count and Continue fit the viewport');
  const countSample=await ev("(()=>{const e=document.querySelector('.count-value'),b=e.getBoundingClientRect();return {value:e.textContent,left:b.left,right:b.right}})()");await delay(140);
  const nextCountSample=await ev("(()=>{const e=document.querySelector('.count-value'),b=e.getBoundingClientRect();return {value:e.textContent,left:b.left,right:b.right}})()");
  check(countSample.value!==nextCountSample.value&&Math.abs(countSample.left-nextCountSample.left)<.5&&Math.abs(countSample.right-nextCountSample.right)<.5,world+' mobile payout counts with stable amount alignment');
  await shot(world.toLowerCase()+'-big-win-count-mobile');
  const countTarget=await ev("(()=>{const b=document.querySelector('.count-continue').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
  check(await ev(`document.elementFromPoint(${countTarget.x},${countTarget.y})?.closest('button')?.matches('.count-continue')`),world+' mobile count button receives pointer input');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...countTarget,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...countTarget,button:'left',clickCount:1});
  await wait("document.querySelector('dialog.big-win-count[open]')?.dataset.counting==='false'",world+' first click finishes counting',1000);
  check(await ev("document.querySelector('.count-value').textContent===document.querySelector('.count-target').textContent&&document.querySelector('main').dataset.busy==='true'&&document.querySelector('.spin-button').disabled"),world+' first click shows the exact payout without closing or placing another wager');
  const continueTarget=await ev("(()=>{const b=document.querySelector('.count-continue').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...continueTarget,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...continueTarget,button:'left',clickCount:1});
  await wait("!document.querySelector('dialog.big-win-count[open]')",world+' second click continues safely',1000);await idle();
  check(await ev("!document.querySelector('dialog.big-win-count[open],.cinematic-active,.winning-payline,.round-error,.modal-scrim')"),world+' counter closes with the paid amount preserved and controls unlocked');
  await viewport(2322,1267);
 }
 // A Blight bonus keeps one silent video through every free spin and pause.
 await viewport(1536,960);await media(false);await navigate(origin+'/?demo=true');await idle();
 await click('.world-choice:nth-child(2)');await click('[aria-label="Toggle turbo"]');
 await click('[aria-label="Open Bonus Buy"]');await click('[aria-label="Select STANDARD bonus"]');
 const confirm=await ev("(()=>{const b=document.querySelector('[aria-label=\"Confirm bonus purchase\"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...confirm,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...confirm,button:'left',clickCount:1});
 await wait("document.querySelector('.free-spins-banner')&&document.querySelector('video')?.readyState>=2",'Blight continuous feature media');
 await ev(`(()=>{const video=document.querySelector('video'),audio=document.querySelector('audio');window.__featureMedia={samples:0,changes:0,paused:0,between:0,counts:[]};const sample=()=>{const b=document.querySelector('.free-spins-banner'),m=window.__featureMedia;if(b){m.samples++;if(document.querySelector('video')!==video||document.querySelector('audio')!==audio)m.changes++;if(video.paused||audio)m.paused++;if(!document.querySelector('.reel-spin-track'))m.between++;const count=b.querySelector('.free-spins-count').getAttribute('aria-label');if(!m.counts.includes(count))m.counts.push(count);}window.__featureMediaRaf=requestAnimationFrame(sample)};sample()})()`);
 await idle();
 const continuous=await ev("(()=>{cancelAnimationFrame(window.__featureMediaRaf);return window.__featureMedia})()");
 check(continuous.samples>30&&continuous.between>0&&continuous.counts.length>=10,'Blight media observed across all ten free spins and pauses');
 check(Array.from({length:10},(_,i)=>`Free spin ${i+1} of 10`).every(label=>continuous.counts.includes(label)),'Blight banner identifies every current free spin consistently');
 check(continuous.changes===0&&continuous.paused===0,'Blight keeps the same muted video throughout the feature');
 await wait("!document.querySelector('audio,video')",'Blight feature media finishes its exit fade',800);
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
 await ev(`(()=>{window.__rollingProbe=new Promise(resolve=>{const samples=[],started=performance.now();let raf,timer,done=false;const finish=(reason,seam)=>{if(done)return;done=true;cancelAnimationFrame(raf);clearTimeout(timer);const positions=samples.map(s=>s.y);resolve({reason,samples,span:positions.length?Math.max(...positions)-Math.min(...positions):0,seam,landing:Boolean(document.querySelector('.reel-landing-track')),busy:document.querySelector('main').dataset.busy,reduced:document.querySelector('main').classList.contains('reduced')})};const sample=now=>{const t=document.querySelector('.reel-spin-track:not(.reel-landing-track)');if(t){const a=t.getAnimations()[0],transform=getComputedStyle(t).transform,y=transform==='none'?0:new DOMMatrixReadOnly(transform).m42;samples.push({ms:Math.round(now-started),y,state:a?.playState??'missing',time:a?.currentTime??null,rate:a?.playbackRate??null});const positions=samples.map(s=>s.y);if(a&&samples.length>=2&&Math.max(...positions)-Math.min(...positions)>.5){a.pause();const frame=ms=>{a.currentTime=ms;const box=t.parentElement.getBoundingClientRect();return [...t.children].map(c=>{const b=c.getBoundingClientRect();return {label:c.querySelector('.symbol').getAttribute('aria-label'),y:(b.top+b.bottom)/2-box.top}}).filter(c=>c.y>0&&c.y<box.height)};const before=frame(479.99),after=frame(.01);a.play();finish('movement observed',{before,after});return;}}else if(document.querySelector('.reel-landing-track')){finish('landing reached before measurable rolling');return;}raf=requestAnimationFrame(sample)};raf=requestAnimationFrame(sample);timer=setTimeout(()=>finish('rolling probe timed out'),1500)});return true})()`);
 await click('.spin-button');const motion=await ev('window.__rollingProbe');
 const moved=motion.reason==='movement observed'&&motion.samples.length>=2&&motion.span>.5;check(moved,'normal reels continuously advance before landing'+(moved?'':': '+JSON.stringify(motion)));
 const seam=motion.seam;
 check(seam.before.length===5&&seam.after.length===5&&seam.before.every((s,i)=>s.label===seam.after[i].label&&Math.abs(s.y-seam.after[i].y)<.1),'reel wrap has matching symbols and subpixel-continuous positions');
 await wait("document.querySelectorAll('.reel-landing-track').length===5",'authoritative reel landing');
 const lossBoard=fixtures.BLOOM[0].events.find(e=>e.type==='reveal').board;
 check(await ev(`(async()=>{const {worldLabels}=await import('/src/petal/config.ts');const expected=${JSON.stringify(lossBoard)};return [...document.querySelectorAll('.reel-landing-track')].every((t,r)=>[...t.children].slice(-5).every((c,row)=>c.querySelector('.symbol').getAttribute('aria-label')===worldLabels.BLOOM[expected[r][row].name??expected[r][row]]))})()`),'landing strip ends with the authoritative loss-book symbols');
 await wait("(()=>{const a=[...document.querySelectorAll('.reel-landing-track')].map(t=>t.getAnimations()[0]);return a.length===5&&a[0]?.playState==='finished'&&a[4]?.playState==='running'})()",'staggered final reel landing');
 check(await ev("document.querySelector('.spin-button').disabled&&!document.querySelector('.winning-payline')"),'wagers stay locked and paylines stay hidden until the last reel lands');
 await idle();
 check(await ev("!document.querySelector('.reel-spin-track,.reels-moving,.round-error')&&!document.querySelector('.spin-button').disabled"),'landing clears motion and unlocks the completed round');
 check(await ev("[...document.querySelectorAll('.reel-column')].every(c=>new Set([...c.querySelectorAll('.reel-cell>.symbol')].map(s=>s.getAttribute('aria-label'))).size>=3)"),'first demo loss lands on mixed symbol columns');
 await shot('bloom-first-spin');
 // A system motion preference can hide the strip even after the in-game override.
 await media(true);await navigate(origin+'/?demo=true');await idle();await click('[aria-label="Open settings"]');
 await ev("[...document.querySelectorAll('.setting')].find(e=>e.textContent.includes('Reduce motion')).querySelector('input').click()");await click('[aria-label="Close dialog"]');
 check(await ev("!document.querySelector('main').classList.contains('reduced')&&matchMedia('(prefers-reduced-motion: reduce)').matches"),'in-game motion override exercised while system preference stays reduced');
 await click('.spin-button');await idle();
 check(await ev("!document.querySelector('.round-error,.reel-spin-track,.reels-moving')&&!document.querySelector('.spin-button').disabled"),'hidden reduced-motion strips settle without invalid geometry or round errors');
 await viewport(1536,960);await media(true);
 for(const world of ['BLOOM','BLIGHT']){
  await navigate(origin+'/?demo=true');await idle();if(world==='BLIGHT')await click('.world-choice:nth-child(2)');
  for(let i=0;i<7;i++){if(i===2)await media(false);await click('.spin-button');if(i===2){
   await wait("document.querySelector('main').dataset.presentingLines==='true'&&Boolean(document.querySelector('.winning-payline'))",world+' paid-line review before big-win counter');
   const wins=fixtures[world][i].events.find(e=>e.type==='winInfo').wins;
   const trail=await ev("(()=>{const p=document.querySelector('.winning-payline');return {line:Number(p.dataset.line),points:p.querySelector('.payline-core').getAttribute('points'),detail:document.querySelector('.line-detail').textContent}})()");
   const paid=wins.find(w=>w.meta.lineIndex===trail.line);
   check(trail.points===[...paid.positions].sort((a,b)=>a.reel-b.reel).map(p=>`${p.reel*20+10},${p.row*20+10}`).join(' ')&&trail.detail.includes('Line '+trail.line+' ·'),world+' trail connects exact authoritative paid positions and matching text');
   await wait(`Number(document.querySelector('.winning-payline')?.dataset.line)!==${trail.line}`,world+' winning lines cycle');
   check(await ev("!document.querySelector('.character-wild')&&Boolean(document.querySelector('.expanded-wild svg'))"),world+' original multiplier vines restored');
   await shot(world.toLowerCase()+'-winning-payline');
  }await idle();if(i===2)await media(true);check(!(await ev("Boolean(document.querySelector('.round-error'))")),world+` base fixture ${i+1} reconciles`);if(i===2)check(await ev("document.querySelectorAll('.expanded-wild').length===1"),world+' expanding reel');if(i===3)check(await ev("document.querySelectorAll('.expanded-wild').length===2"),world+' multiple expanded reels');}
  check(await ev("document.querySelector('.win-presentation strong').textContent.includes('5,000')"),world+' cap displayed');
 }
 // Idle paylines dismiss from the heading, touch input and click-only activation.
 for(const input of ['mouse','touch','click-only']){
  await viewport(input==='touch'?390:1536,input==='touch'?844:960);await media(false);await navigate(origin+'/?demo=true');await idle();await click('[aria-label="Toggle turbo"]');
  for(let i=0;i<2;i++){await click('.spin-button');await idle();}
  check(await ev("Boolean(document.querySelector('.winning-payline'))&&!document.querySelector('.spin-button').disabled&&document.querySelector('.line-detail').textContent.includes('Line ')"),input+' idle winning lines are visible before dismissal');
  const winnings=await ev("document.querySelector('.win-presentation strong').textContent");
  if(input==='click-only')await ev("document.querySelector('[aria-label=\"Open game rules\"]').click()");
  else{
   const target=await ev(`(()=>{const b=document.querySelector(${JSON.stringify(input==='mouse'?'.title-lockup h1':'[aria-label="Open game rules"]')}).getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
   if(input==='touch'){await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...target,id:1,radiusX:1,radiusY:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...target,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});}
  }
  check(await ev(`!document.querySelector('.winning-payline,.reel-cell.winning,.petal-modal')&&!document.querySelector('.line-detail').textContent.trim()&&document.querySelector('.win-presentation strong').textContent===${JSON.stringify(winnings)}`),input+' dismissal clears trails, highlights and line labels without changing winnings or activating controls');
  if(input==='mouse')await shot('lines-skipped');
  const next=await ev("(()=>{const b=document.querySelector('[aria-label=\"Open game rules\"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...next,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...next,button:'left',clickCount:1});
  check(await ev("Boolean(document.querySelector('.petal-modal'))"),input+' next genuine click opens the requested control');await click('[aria-label="Close dialog"]');
  if(input==='touch')await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 }
 await viewport(1536,960);await media(true);
 await navigate(origin+'/?demo=true');await idle();await click('[aria-label="Start 10 autoplay spins"]');await click('[aria-label="Confirm 10 autoplay spins"]');await wait("document.querySelector('[aria-label=\"Stop autoplay\"]')",'auto starts');await click('[aria-label="Stop autoplay"]');await idle();check(await ev("Boolean(document.querySelector('[aria-label=\"Start 10 autoplay spins\"]'))"),'autoplay stops');
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
 // Optional/opaque RGS identities must not block valid books or merge wagers.
 playBookIndex=1;
 for(const kind of ['betID','opaque','none']){
  identityKind=kind;await navigate(live);await idle();const before={...counts};
  for(let i=0;i<2;i++){await click('.spin-button');await idle();}
  check(counts.play===before.play+2&&counts.end===before.end+2&&await ev("!document.querySelector('.round-error')"),kind+' identity: two valid consecutive wagers settle separately');
 }
 const dedupBefore={...counts};
 const walletChecks=await ev(`(async()=>{const {record,settle,validateWallet}=await import('/src/petal/rgs.ts');const book=(await import('/src/petal/fixtures.json')).default.BLOOM[1];const round={amount:1000000,payout:book.payoutMultiplier*10000,payoutMultiplier:book.payoutMultiplier/100,mode:'BLOOM',state:book.events,active:true};validateWallet(round,1);let rejected=false;try{validateWallet({...round,payout:999999},1)}catch{rejected=true}await record(round,0);await record(round,0);await settle(round);await settle(round);return rejected})()`);
 check(walletChecks&&counts.event===dedupBefore.event+1&&counts.end===dedupBefore.end+1,'ID-less round deduplicates repeated progress/settlement and retains payout validation');
 identityKind='numeric';playBookIndex=2;
 // Dismiss while winInfo awaits acknowledgment, before setTotalWin can start its sequence.
 await media(false);await navigate(live);await idle();holdWinInfo=true;await click('.spin-button');await wait("Boolean(document.querySelector('.winning-payline'))",'live winInfo displayed before acknowledgment');
 for(let i=0;i<60&&!releaseWinInfo;i++)await delay(25);
 check(Boolean(releaseWinInfo)&&await ev("document.querySelector('main').dataset.presentingLines==='false'&&!document.querySelector('dialog.big-win-count[open],video.cinematic')"),'live winInfo acknowledgment held before the big-win count');
 const early=await ev("(()=>{const b=document.querySelector('.title-lockup h1').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...early,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...early,button:'left',clickCount:1});
 check(await ev("!document.querySelector('.winning-payline,.reel-cell.winning')&&!document.querySelector('.line-detail').textContent.trim()"),'early live click clears the pending line display');
 holdWinInfo=false;const release=releaseWinInfo;releaseWinInfo=undefined;release();
 await wait("Boolean(document.querySelector('dialog.big-win-count[open]'))",'early live dismissal skips the future hidden line delay',1100);
 check(await ev("document.querySelector('main').dataset.busy==='true'&&document.querySelector('.spin-button').disabled&&!document.querySelector('video,audio')"),'live count keeps wagering locked without cinematic media');
 await click('.count-continue');await wait("document.querySelector('dialog.big-win-count[open]')?.dataset.counting==='false'",'live count skips to the exact payout');await click('.count-continue');await idle();
 check(await ev("!document.querySelector('.round-error,dialog.big-win-count[open]')&&document.querySelector('main').dataset.presentingLines==='false'&&document.querySelector('.wallet strong').textContent.includes('1,000.20')"),'early live dismissal still settles the authoritative payout');await media(true);
 // A previous small win must not consume Stop while the next autoplay wager is pending.
 await navigate(live);await idle();const beforeAuto=counts.play;playBookIndex=1;holdPlayAt=beforeAuto+2;await click('[aria-label="Start 10 autoplay spins"]');await click('[aria-label="Confirm 10 autoplay spins"]');
 for(let i=0;i<160&&!releasePlay;i++)await delay(25);
 check(Boolean(releasePlay)&&await ev("document.querySelector('main').dataset.busy==='true'&&!document.querySelector('.winning-payline')&&Boolean(document.querySelector('[aria-label=\"Stop autoplay\"]'))"),'second autoplay request held after a small win with no line overlay');
 const stop=await ev("(()=>{const b=document.querySelector('[aria-label=\"Stop autoplay\"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()");
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...stop,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...stop,button:'left',clickCount:1});
 check(await ev("document.querySelector('main').dataset.busy==='true'&&!document.querySelector('[aria-label=\"Stop autoplay\"]')&&Boolean(document.querySelector('[aria-label=\"Start 10 autoplay spins\"]'))"),'one genuine Stop click cancels autoplay while the wager reply is pending');
 holdPlayAt=-1;playBookIndex=2;const releaseAuto=releasePlay;releasePlay=undefined;releaseAuto();await idle();await delay(100);
 check(counts.play===beforeAuto+2&&await ev("!document.querySelector('.round-error,[aria-label=\"Stop autoplay\"]')"),'released autoplay wager settles without starting another round');
 recovery=true;completedRecovery=true;const completedSnapshot={...counts};await navigate(live);await idle();
 check(await ev("document.querySelector('main').dataset.world==='BLOOM'&&document.querySelector('.win-presentation strong').textContent.includes('0.00')")&&counts.play===completedSnapshot.play&&counts.event===completedSnapshot.event&&counts.end===completedSnapshot.end,'completed authenticated round is not recovered or settled again');completedRecovery=false;
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
  check(await ev("!document.querySelector('.bet-controls,.spin-button')&&Boolean(document.querySelector('[aria-label=\"Play replay\"]'))"),mode+' replay presents Play without wagering controls');await click('[aria-label="Play replay"]');await idle();check(await ev("Boolean(document.querySelector('[aria-label=\"Play replay again\"]'))"),mode+' replay can be played again');
  check(counts.play===snapshot.play&&counts.event===snapshot.event&&counts.end===snapshot.end,mode+' played replay has no wallet writes');
  if(mode.includes('BONUS'))check(await ev("document.querySelector('.purchase-receipt')?.textContent.includes('Super Bonus')"),'bonus replay preserves full price and variant');
 }
 check(await ev("document.querySelector('main').classList.contains('reduced')"),'reduced motion honored');
 const decoded=await ev(`(async()=>{const {decodeRound}=await import('/src/petal/MathEventAdapter.ts');const base=(await import('/src/petal/fixtures.json')).default;const bonus=(await import('/src/petal/bonus-fixtures.json')).default;let passed=0;for(const [mode,books] of Object.entries({...base,...bonus}))for(const b of books){decodeRound({mode,state:b.events,payoutMultiplier:b.payoutMultiplier/100});passed++;}let rejected=0;for(const mode of ['BLOOM_SUPER_BONUS','BLOOM_MYTHIC_BONUS']){const b=structuredClone(bonus[mode][0]);b.events.find(e=>e.type==='expandWilds').wilds=[];try{decodeRound({mode,state:b.events})}catch{rejected++}}return{passed,rejected}})()`);
 check(decoded.passed===32&&decoded.rejected===2,'32 Python fixtures decode; missing purchase guarantees reject');
 check(retiredBigMediaRequests.length===0,'no retired big-win video, soundtrack or poster requests '+JSON.stringify(retiredBigMediaRequests));
 check(errors.length===0,'no browser runtime exceptions');
 const report={passed:results,counts,modes,errors,retiredBigMediaRequests};console.log(JSON.stringify(report,null,2));writeFileSync(join(output,'browser-results.json'),JSON.stringify(report,null,2));
}catch(e){writeFileSync(join(output,'browser-failure.txt'),String(e));throw e;}finally{socket?.close();browser.kill();}
