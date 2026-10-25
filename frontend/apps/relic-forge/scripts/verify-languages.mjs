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
  return{roundID:500+counts.play,amount:1000000,payout:b.payoutMultiplier*10000,payoutMultiplier:b.payoutMultiplier/100,mode,state:b.events,active:true,event:recovery?Math.floor(b.events.length/2):null};
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

 const languages=['ar','da','de','en','es','fi','fr','hi','id','ja','ko','pl','pt','ru','tr','vi','zh'];
 const missing={},fonts={},layout=[];
 const sourcePack=JSON.parse(readFileSync('src/petal/locales/en.json','utf8'));
 const slots=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
 await viewport(1536,960);await media(true);
 for(const code of languages){
  const pack=JSON.parse(readFileSync(`src/petal/locales/${code}.json`,'utf8'));
  check(Object.keys(pack).length===Object.keys(sourcePack).length&&Object.entries(sourcePack).every(([key,value])=>typeof pack[key]==='string'&&pack[key].length>0&&slots(pack[key])===slots(value)),code+' complete catalog and matching placeholders');
  await navigate(origin+`/?demo=true&lang=${code}`);await idle();await ev('document.fonts.ready');
  check(await ev(`document.documentElement.lang===${JSON.stringify(code)}&&document.documentElement.dir===${JSON.stringify(code==='ar'?'rtl':'ltr')}`),code+' document language/direction');
  check(await ev("document.querySelector('main').dataset.world==='BLOOM'"),code+' Bloom remains default');
  const expected=code==='en'?'SPIN':pack.spin;
  check(await ev(`document.querySelector('.spin-button span').textContent===${JSON.stringify(expected)}`),code+' translated spin control');
  check(await ev("getComputedStyle(document.querySelector('.reel-window')).direction==='ltr'"),code+' authoritative reel order stays LTR');
  fonts[code]=await ev("[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)");
  for(const [width,height] of [[1536,960],[390,844],[320,568],[844,390]]){
   await viewport(width,height);await delay(80);
   const m=await ev("(()=>{const p=document.querySelector('.bet-controls').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.bet-controls button')].every(e=>{const b=e.getBoundingClientRect();return b.left>=p.left-.5&&b.right<=p.right+.5}),viewport:[innerWidth,innerHeight]}})()");
   check(!m.overflow&&m.buttons,code+' layout '+width+'x'+height+' '+JSON.stringify(m));layout.push({code,...m});
   if(width===390&&['ar','pt','ja','hi','ru'].includes(code))await shot('language-'+code+'-mobile');
  }
  await viewport(1536,960);await click('.header-tools button:nth-child(1)');
  check(await ev(`document.querySelector('.petal-modal').textContent.includes(${JSON.stringify(pack.rulesBoard)})&&document.querySelector('.petal-modal').textContent.includes(${JSON.stringify(pack.rulesWild)})&&document.querySelectorAll('tbody tr').length===8`),code+' localized rules/paytable');await click('.modal-close');
  await click('.bet-controls .secondary-control');
  check(await ev(`document.querySelector('dialog.auto-confirm h2').textContent===${JSON.stringify(code==='en'?'Start autoplay?':pack.startAutoplay)}&&document.querySelector('dialog.auto-confirm .actions button').getAttribute('aria-label')===${JSON.stringify(code==='en'?'Cancel autoplay':pack.cancel)}`),code+' localized autoplay confirmation and cancel label');await click('dialog.auto-confirm .actions button');
  await click('[aria-label='+JSON.stringify((code==='en'?'Open Bonus Buy':pack.bonusBuy))+']');await click('[data-bonus-mode="BLOOM_STANDARD_BONUS"] .bonus-select');
  check(await ev(`document.querySelector('.purchase-total dt').textContent===${JSON.stringify(pack.fullCost)}`),code+' localized full-price confirmation');await click('.modal-close');
  for(let i=0;i<5;i++){
   await click('.spin-button');
   if(i===2){await wait("Boolean(document.querySelector('dialog.big-win-count[open]'))",code+' localized win counter');check(await ev(`document.querySelector('dialog.big-win-count h2').textContent===${JSON.stringify(code==='en'?'BIG WIN':pack.bigWin)}`),code+' localized big win');await click('.count-continue');}
   if(i===4){await wait("Boolean(document.querySelector('dialog.award[open]'))",code+' localized free-spin award');check(await ev(`document.querySelector('dialog.award h2').textContent===${JSON.stringify(code==='en'?'FREE SPINS':pack.freeSpins)}`),code+' localized free-spin award');await click('dialog.award button');}
   await idle();
  }
  await click('.world-choice:nth-child(2)');
  check(await ev(`document.querySelector('main').dataset.world==='BLIGHT'&&document.querySelector('.world-description').textContent.includes(${JSON.stringify(code==='en'?'Rarer features':pack.blightDesc)})`),code+' localized Blight world');
  await click('[aria-label='+JSON.stringify((code==='en'?'Open Bonus Buy':pack.bonusBuy))+']');await click('[data-bonus-mode="BLIGHT_MYTHIC_BONUS"] .bonus-select');
  check(await ev(`document.querySelector('.purchase-confirmation h3').textContent.includes(${JSON.stringify(code==='en'?'Mythic':pack.mythic)})&&document.querySelector('.purchase-total dt').textContent===${JSON.stringify(pack.fullCost)}`),code+' localized Blight Mythic confirmation');await click('.modal-close');
  missing[code]=await ev("(async()=>[...(await import('/src/petal/i18n.ts')).untranslatedSources])()");
 }
 check(errors.length===0,'no language runtime errors');check(Object.values(missing).every(items=>items.length===0),'no missing authored UI translations');
 const report={passed:results,missing,fonts,layout,errors};writeFileSync(join(output,'languages-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:results.length,missing,errors},null,2));
}catch(e){writeFileSync(join(output,'languages-failure.txt'),String(e));throw e;}finally{socket?.close();browser.kill();}
