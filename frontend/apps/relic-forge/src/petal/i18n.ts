import { stateUrlDerived } from 'state-shared';
import en from './locales/en.json';
import ar from './locales/ar.json';
import da from './locales/da.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fi from './locales/fi.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import trPack from './locales/tr.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

export const catalogs = { ar, da, de, en, es, fi, fr, hi, id, ja, ko, pl, pt, ru, tr: trPack, vi, zh };
export type Language = keyof typeof catalogs;
export type TextKey = keyof typeof en;
export const supportedLanguages = Object.keys(catalogs) as Language[];
export function normalizeLanguage(value: string): Language {
 const code=value.toLowerCase().replace('_','-').split('-')[0];
 return code==='br'?'pt':Object.hasOwn(catalogs,code)?code as Language:'en';
}
export const language = () => normalizeLanguage(stateUrlDerived.lang());
const localeNames: Partial<Record<Language,string>> = { en:'en-US', pt:'pt-BR', zh:'zh-CN', ar:'ar-EG' };
export const locale = () => localeNames[language()] ?? language();
export const number = (value: number, options: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat(locale(),options).format(value);
export function t(key: TextKey, values: Record<string, string | number> = {}) {
 return catalogs[language()][key].replace(/\{(\w+)\}/g,(match,name)=>String(values[name]??match));
}

const aliases: Partial<Record<TextKey,string[]>> = {
 ready:['A little magic is waiting.','A little garden magic','Make yourself at home'],
 win:['Your magic is growing.'], bigWin:['A wonderful windfall!'], noWin:['Another petal, another possibility.'],
 gift:['Your garden’s gift'], maxWin:['5,000× · The garden’s greatest gift'],
 bloomDesc:['More frequent features · Gentler magic','Where a little kindness grows into magic.'],
 blightDesc:['Rarer features · Greater volatility','Where the last light meets the shadows.'],
 bloomCaption:['EVERY FLOWER HOLDS A LITTLE'], blightCaption:['EVEN IN DARKNESS, THERE IS'],
 bloomGarden:['THE ENCHANTED GARDEN','A garden full of possibility'], blightGarden:['THE WITHERED GARDEN','What sleeps beneath the roots'],
 freeSpins:['THE PETALS AWAKEN','10 Free Spins','10 FREE SPINS','3 SCATTERS · 10 FREE SPINS','· 10 FREE SPINS','Choose a bonus. Ten Free Spins. A little more magic.','3 Scatters award 10 Free Spins.'],
 standard:['A LITTLE WONDER'], super:['ROOTED IN MAGIC'], mythic:['THE RAREST CHAPTER'],
 goodLuck:['Let your fortune blossom.','See what the shadows keep.'],
 twoWorlds:['TWO WORLDS. ONE LAST PETAL.','AN ENCHANTED','TALE OF FORTUNE'],
 settings:['Open settings','Game settings'], rules:['Open game rules'],
 close:['Close dialog','Close Bonus Buy'], bonusBuy:['Open Bonus Buy','Confirm Bonus Buy','Bonus Buy:'],
 spin:['Spin'], start10:['Start 10 autoplay spins','Confirm 10 autoplay spins'], stopAutoplay:['Stop autoplay'], turbo:['Toggle turbo'],
 cancel:['Cancel autoplay'], confirmPurchase:['Confirm bonus purchase','Confirm your purchase to enter the feature.','Your next chapter awaits'],
 complete:['Feature complete'], replay:['READ-ONLY REPLAY','Replay controls'], playAgain:['Play replay again'], play:['Play replay'],
 devMath:['DEVELOPMENT DEMO · FIXED SHOWCASE BOOKS','Bonus Buy development math'],
 locked:['Development prices and books · Connected purchasing remains locked until production validation.','Connected purchases are locked pending production math and Stake mode validation.'],
 insufficient:['Insufficient balance. Lower your base bet to reduce the purchase cost.'],
 invalidBet:['Select a valid base bet.'],
 roundError:['The round could not be presented safely.','This replay has no authoritative round.','Server world does not match the selected wager. Reload to recover.','Server mode does not match this purchase. Reload to recover.','Server purchase price does not match the confirmed cost. Reload to recover.','Invalid recovery cursor. Reload to recover this round.','The authenticated round state is invalid.'],
 replayError:['The replay response contained invalid round state.'],
 sessionRequired:['A Stake session is required. Add ?demo=true only in local development.'],
 sessionIncomplete:['This session is incomplete. Both sessionID and rgs_url are required.'],
 rulesBoard:['Five reels, five rows, twenty paylines'],
 devInfo:['Measured finite development libraries, not certified production math. Deterministic demo fixtures showcase features; they do not sample these probabilities.'],
 rulesCost:['Costs shown are the full purchase amount. Expanding reels stay sticky throughout the feature. No retriggers.'],
 normalWild:['Normal expanding Wilds. Every new Wild reel stays for the feature.'],
 guaranteedWild:['At least one expanding Wild reel guaranteed on the first Free Spin.'],
 turboInfo:['Turbo shortens the presentation. Your outcome and winnings stay the same.'],
 pending:['Purchasing…'],
 flowerpot:['Flowerpot','Flower'], brooch:['Guardian Brooch','Old key'], hammer:['Traveler Hammer','Spellbook'], hat:['Traveler Hat','Mushroom'],
 petalWild:['Withered Petal Wild'], scatter:['Flower Scatter','Corrupted Flower Scatter'],
 paid:['Paid'], capped:[' · capped'],
};
const sourceKeys = new Map<string, TextKey>();
for(const [key,value] of Object.entries(en)) sourceKeys.set(value.toLowerCase(),key as TextKey);
for(const [key,values] of Object.entries(aliases)) for(const value of values)sourceKeys.set(value.toLowerCase(),key as TextKey);
export const untranslatedSources = new Set<string>();
const names = new Set(['The Last Petal','THE LAST PETAL','THE LAST PETAL ·','Bloom','Blight','Keeper','Traveler','Guardian','Bloom Keeper','Lantern Traveler','Elderly Guardian','Withered Keeper','Skull Gnome','Corrupted Brute']);

/** Translate authored UI copy; identifiers, asset paths and event data stay unchanged. */
export function tr(source: string): string {
 if(language()==='en'||!source.trim())return source;
 const value=source.trim();
 if(/^(?:·\s*)?10 Free Spins$/i.test(value))return `${value.startsWith('·')?'· ':''}${number(10)} ${t('freeSpins')}`;
 if(value==='3 SCATTERS · 10 FREE SPINS')return `${number(3)} ${t('scatter')} · ${number(10)} ${t('freeSpins')}`;
 const key=sourceKeys.get(value.toLowerCase());
 let result=key?t(key):'';
 if(!result){
  const free=value.match(/^Free [Ss]pin (\d+) of 10$/);
  const compact=value.match(/^Spin (\d+) \/ 10$/);
  const remaining=value.match(/^(\d+) free spins$/i);
  const variant=value.match(/^(Standard|Super|Mythic) Bonus$/);
  const buy=value.match(/^Buy for (.+)$/);
  const enhanced=value.match(/^A starting Wild of at least (\d+)×, guaranteed on the first Free Spin\.$/);
  const selected=value.match(/^Select (STANDARD|SUPER|MYTHIC) bonus$/);
  const line=value.match(/^(Winning line|Line) (\d+)(.*)$/);
  if(free)result=t('freeSpinProgress',{n:number(Number(free[1]))});
  else if(compact)result=t('spinProgress',{n:number(Number(compact[1]))});
  else if(remaining)result=`${t('freeSpins')}: ${number(Number(remaining[1]))}`;
  else if(variant)result=`${t(variant[1].toLowerCase() as TextKey)} ${t('bonus')}`;
  else if(buy)result=t('buyFor',{amount:buy[1]});
  else if(enhanced)result=t('enhancedWild',{n:number(Number(enhanced[1]))});
  else if(selected)result=`${t('select')} ${t(selected[1].toLowerCase() as TextKey)} ${t('bonus')}`;
  else if(line)result=`${t('line')} ${number(Number(line[2]))}${line[3].replace(' · capped',` · ${t('capped')}`)}`;
  else if(value.startsWith('The petals awaken · '))result=value.replace('The petals awaken',t('gift')).replace('Free Spins',t('freeSpins'));
  else if(/Free Spins$/.test(value))result=value.replace('Free Spins',t('freeSpins'));
  else if(value==='· BALANCE')result=`· ${t('balance')}`;
  else if(value==='× BASE BET')result=`× ${t('baseBet')}`;
  else if(value.endsWith(' Bonus Buy'))result=value.replace('Bonus Buy',t('bonusBuy'));
  else if(value.startsWith('Session '))result=value.replace('Session',t('session'));
  else if(value.startsWith('· Net '))result=value.replace('Net',t('net'));
  else if(value==='Standard'||value==='Super'||value==='Mythic')result=t(value.toLowerCase() as TextKey);
  else if(value==='Winning line')result=t('line');
  else if(value==='The Lantern Traveler'||value==='The Withered Keeper')result=value;
  else if(value==='Magical forest traveler holding a lantern staff')result=`Bloom · ${t('lantern')}`;
  else if(value==='Hooded Blight creature with a chained weapon')result=`Blight · ${t('flail')}`;
  else if(/(?:cannot|could not|invalid|missing|not match|not enabled|uncertain)/i.test(value))result=t('roundError');
 }
 if(!result){if(import.meta.env.DEV&&!names.has(value)&&/[A-Za-z]/.test(value))untranslatedSources.add(value);return source;}
 return source.replace(value,result);
}
