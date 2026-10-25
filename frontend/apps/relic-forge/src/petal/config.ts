import rules from './rules.json';
import { tr } from './i18n';
import type { SymbolId, World } from './types';
export { rules };
export const symbolIds = [...Object.keys(rules.paytable), ...rules.specials] as SymbolId[];
export const labels: Record<SymbolId, string> = { keeper: 'Keeper', traveler: 'Traveler', guardian: 'Guardian', flower: 'Flower', lantern: 'Lantern', key: 'Old key', book: 'Spellbook', mushroom: 'Mushroom', wild: 'Petal Wild', scatter: 'Flower Scatter' };
const worldLabelSources: Record<World, Record<SymbolId,string>> = {
 BLOOM: { ...labels, keeper:'Bloom Keeper',traveler:'Lantern Traveler',guardian:'Elderly Guardian',flower:'Flowerpot',lantern:'Lantern',key:'Guardian Brooch',book:'Traveler Hammer',mushroom:'Traveler Hat' },
 BLIGHT: { ...labels, keeper:'Withered Keeper',traveler:'Skull Gnome',guardian:'Corrupted Brute',flower:'Stone',lantern:'Chained Flail',key:'Belt Pouch',book:'Shears',mushroom:'Spiked Club',wild:'Withered Petal Wild',scatter:'Corrupted Flower Scatter' },
};
export const worldLabels = new Proxy(worldLabelSources, { get(target, world: World) { return Object.fromEntries(Object.entries(target[world]).map(([id,label])=>[id,tr(label)])); } });
export const art = (world: World, role: string) => `./art/${world.toLowerCase()}-${role}.webp?v=2`;
export const initialBoard = (): SymbolId[][] => Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, row) => symbolIds[(r * 3 + row) % 8]));
export const betLevels = [.2,.5,1,2,5,10,20,50];

