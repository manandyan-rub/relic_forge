import { rules, symbolIds } from './config';
import type { BookEvent, Round, SymbolId, World, Wild, Mode } from './types';
import { bonusConfig, isBonusMode } from './bonus';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, max = rules.cap): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
const assert: (value: unknown, reason: string) => asserts value = (value, reason) => { if (!value) throw new Error(`Unsupported Last Petal book: ${reason}. Reload to recover this round.`); };
const allowed = new Set(['bonusStart','reveal','expandWilds','stickyWildState','winInfo','setWin','setTotalWin','freeSpinTrigger','updateFreeSpin','freeSpinEnd','wincap','finalWin']);
export function decodeRound(round: Round, expectedWorld?: World): { world: World; mode: Mode; costMultiplier:number; events: BookEvent[]; payout: number } {
 assert(Array.isArray(round.state) && round.state.length > 0, 'missing events');
 const raw = round.state;
 const first = raw[0];
 assert(object(first) && ['reveal','bonusStart'].includes(String(first.type)) && first.contract === rules.version, 'contract version');
 const world = first.world;
 assert(world === 'BLOOM' || world === 'BLIGHT', 'world');
 assert(!expectedWorld || expectedWorld === world, 'selected world mismatch');
 const mode = first.type==='bonusStart' ? first.mode : world;
 assert(typeof mode==='string' && (mode===world || isBonusMode(mode)), 'mode');
 const bonus = isBonusMode(mode) ? bonusConfig[mode] : undefined;
 assert(!round.mode || round.mode === mode, 'round mode mismatch');
 assert(!bonus || (bonus.world===world && first.variant===bonus.variant && first.type==='bonusStart'), 'bonus identity');
 assert(!bonus || (integer(first.purchaseCostMultiplier,10000000)&&first.purchaseCostMultiplier>0), 'original purchase price');
 const costMultiplier=bonus?Number(first.purchaseCostMultiplier):1;
 const multiplierPool = bonus?.multipliers ?? rules.modes[world].multipliers;
 let board: SymbolId[][] | undefined;
 let expanded = new Map<number, number>();
 let sticky = new Map<number, number>();
 let feature = false, featureEnded = false, fs = 0, seenWin = false, seenExpansion = false;
 let total = 0, spinWin = 0, baseWin = 0, finals = 0, needFeatureReveal = false;
 const events: BookEvent[] = [];
 const wilds = (value: unknown, seeds = false): Wild[] => {
  assert(Array.isArray(value), 'Wild list');
  const reels = new Set<number>();
  return value.map(w => {
   assert(object(w) && integer(w.reel,4) && integer(w.multiplier,100) && w.multiplier > 0 && !reels.has(w.reel), 'Wild state');
   assert(multiplierPool.includes(w.multiplier), 'mode multiplier pool');
   assert(!seeds || integer(w.row,4), 'Wild seed'); reels.add(w.reel);
   return { reel: w.reel, multiplier: w.multiplier, ...(seeds ? { row: Number(w.row) } : {}) };
  });
 };
 for (let index = 0; index < raw.length; index++) {
  const e = raw[index];
  assert(object(e) && integer(e.index,10000) && e.index === index && typeof e.type === 'string' && allowed.has(e.type), 'event or index');
  assert(finals === 0, 'events after finalWin');
  if (e.type === 'bonusStart') {
   assert(index===0 && bonus && e.totalFs===10 && e.mode===mode && e.world===world, 'purchased entry');
   feature=true; seenWin=true;
  } else if (e.type === 'reveal') {
   assert(e.contract === rules.version && e.world === world, 'reveal world/version');
   assert(!e.mode || e.mode===mode, 'reveal mode');
   assert(e.gameType === (feature && !featureEnded ? 'freegame' : 'basegame'), 'game type');
   assert(index === 0 || (feature && fs > 0 && seenWin), 'unexpected reveal');
   assert(index === 0 || needFeatureReveal, 'missing Free Spin update'); needFeatureReveal = false;
   assert(Array.isArray(e.board) && e.board.length === 5, 'reel count');
   board = e.board.map(col => { assert(Array.isArray(col) && col.length === 5, 'row count'); return col.map(s => { const id = object(s) ? s.name : s; assert(typeof id === 'string' && symbolIds.includes(id as SymbolId), 'symbol'); return id as SymbolId; }); });
   for (const [r] of sticky) assert(board[r].every(s => s === 'wild'), 'sticky reel disappeared');
   expanded = new Map(sticky); seenWin = false; seenExpansion = false;
  } else if (e.type === 'expandWilds') {
   assert(board && !seenWin && !seenExpansion && e.sticky === feature, 'expansion order');
   for (const w of wilds(e.wilds,true)) { assert(!expanded.has(w.reel) && board[w.reel][w.row!] === 'wild', 'expansion seed'); expanded.set(w.reel,w.multiplier); board[w.reel] = Array(5).fill('wild'); }
   seenExpansion = true;
  } else if (e.type === 'stickyWildState') {
   assert(feature && !seenWin, 'sticky outside feature');
   const next = wilds(e.wilds);
   assert(next.length === expanded.size && next.every(w => expanded.get(w.reel) === w.multiplier), 'sticky snapshot');
   sticky = new Map(next.map(w => [w.reel,w.multiplier]));
  } else if (e.type === 'winInfo') {
   assert(board && !seenWin && Array.isArray(e.wins) && integer(e.totalWin), 'win data');
   if(bonus && fs===1) {
    assert(expanded.size>=bonus.startingWildReels, 'missing guaranteed starting Wild');
    assert(!bonus.startingWildReels || [...expanded.values()].some(m=>m>=bonus.minimumStartingMultiplier), 'missing enhanced starting multiplier');
   }
   let sum = 0; const lines = new Set<number>();
   const expected: { line: number; symbol: string; count: number; base: number; mult: number; raw: number; credit: number }[] = [];
   let budget = rules.cap-total;
   for (const [line, path] of rules.lines.entries()) {
    let best: (typeof expected)[number] | undefined;
    for (const [symbol,pays] of Object.entries(rules.paytable)) {
     let count=0;
     for (const [r,row] of path.entries()) { if (![symbol,'wild'].includes(board[r][row])) break; count++; }
     if (count<3) continue;
     const mult=Math.max(1,path.slice(0,count).reduce((n,row,r)=>n+(board![r][row]==='wild'?expanded.get(r)??0:0),0));
     const base=pays[count-3], raw=base*mult;
     if(!best || raw>best.raw) best={line:line+1,symbol,count,base,mult,raw,credit:Math.min(raw,budget)};
    }
    if(best && budget>0) {expected.push(best);budget-=best.credit;}
   }
   assert(e.wins.length===expected.length, 'missing or additional winning lines');
   for (let n=0;n<expected.length;n++) {
    const w=e.wins[n], x=expected[n];
    assert(object(w) && object(w.meta) && w.meta.lineIndex===x.line && w.symbol===x.symbol && w.kind===x.count && w.win===x.credit, 'best-payline evaluation');
   }
   for (const v of e.wins) {
    assert(object(v) && object(v.meta) && integer(v.win) && integer(v.kind,5) && v.kind >= 3 && typeof v.symbol === 'string' && v.symbol in rules.paytable, 'line');
    const lineIndex = Number(v.meta.lineIndex);
    assert(integer(lineIndex,20) && lineIndex > 0 && !lines.has(lineIndex), 'duplicate/invalid line'); lines.add(lineIndex);
    const path = rules.lines[lineIndex-1];
    assert(Array.isArray(v.positions) && v.positions.length === v.kind && v.positions.every((p,r) => object(p) && p.reel === r && p.row === path[r] && (board![r][path[r]] === v.symbol || board![r][path[r]] === 'wild')), 'winning positions');
    const mult = Math.max(1, path.slice(0,v.kind).reduce((n,row,r) => n + (board![r][row] === 'wild' ? expanded.get(r) ?? 0 : 0),0));
    const base = rules.paytable[v.symbol as keyof typeof rules.paytable][v.kind-3];
    assert(v.meta.lineMultiplier === mult && v.meta.winWithoutMult === base && v.uncappedWin === base*mult && v.win === Math.min(base*mult,rules.cap-total-sum), 'line reconciliation');
    sum += v.win;
   }
   assert(sum === e.totalWin && total+sum <= rules.cap, 'spin reconciliation');
   spinWin = sum; total += sum; if (!feature) baseWin = total; seenWin = true;
  } else if (e.type === 'freeSpinTrigger') {
   assert(!feature && board && board.flat().filter(s => s === 'scatter').length >= 3 && e.totalFs === 10 && seenWin, 'feature trigger'); feature = true;
  } else if (e.type === 'updateFreeSpin') {
   assert(feature && !featureEnded && !needFeatureReveal && e.amount === fs+1 && e.total === 10 && fs < 10 && seenWin, 'Free Spin progression'); fs++; needFeatureReveal = true;
  } else if (e.type === 'freeSpinEnd') {
   assert(feature && !featureEnded && !needFeatureReveal && (fs === 10 || total === rules.cap) && e.amount === total-baseWin && seenWin, 'feature reconciliation'); featureEnded = true;
  } else if (e.type === 'setWin') assert(e.amount === spinWin && seenWin, 'setWin');
  else if (e.type === 'setTotalWin') assert(e.amount === total && seenWin, 'setTotalWin');
  else if (e.type === 'wincap') assert(e.amount === rules.cap && total === rules.cap, 'cap');
  else if (e.type === 'finalWin') { assert(index === raw.length-1 && seenWin && (!feature || featureEnded) && e.amount === total, 'final reconciliation'); finals++; }
  events.push({ ...e, ...(e.type === 'reveal' ? { board: (e.board as unknown[][]).map(col => col.map(s => (object(s) ? s.name : s) as SymbolId)) } : {}) } as BookEvent);
 }
 assert(finals === 1, 'missing finalWin');
 if (round.payoutMultiplier !== undefined) assert(Math.abs(round.payoutMultiplier - total/100) < 1e-9, 'wallet multiplier');
 return { world, mode: mode as Mode, costMultiplier, events, payout: total };
}
