import { requestBet, requestEndEvent, requestEndRound } from 'rgs-requests';
import { stateBet, stateConfig, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import fixtures from './fixtures.json';
import bonusFixtures from './bonus-fixtures.json';
import { bonusConfig, isBonusMode, modeCost } from './bonus';
import { decodeRound } from './MathEventAdapter';
import type { Round, World, Mode, BonusMode } from './types';
export const replay = () => stateUrlDerived.replay();
export const demo = () => import.meta.env.DEV && stateUrlDerived.demo() && !stateUrlDerived.sessionID() && !stateUrlDerived.rgsUrl() && !replay();
export const available = (world: World) => {
 if (demo()) return true;
 const mode = Object.entries(stateConfig.betModes).find(([key, value]) => key === world || value.mode === world)?.[1];
 return Boolean(mode && (mode.costMultiplier ?? mode.cost) === 1 && !mode.buyBonus);
};
export function bonusUnavailableReason(mode: BonusMode): string {
 if(replay())return 'Purchases are unavailable during replay.';
 if(stateConfig.jurisdiction?.disabledBuyFeature)return 'Bonus Buy is unavailable in your jurisdiction.';
 if(demo())return '';
 if(!bonusConfig[mode].connectedApproved)return 'Connected purchases are locked pending production math and Stake mode validation.';
 // Studio builds the session's mode list from index.json (name + cost), which carries no
 // buyBonus flag. Require the exact mode and price when the session lists modes; the RGS stays
 // authoritative and the book's recorded purchase price is checked again before playback.
 const listed=Object.entries(stateConfig.betModes ?? {});
 if(!listed.length) return '';
 const advertised=listed.find(([key,v])=>key.toUpperCase()===mode||String(v?.mode??'').toUpperCase()===mode)?.[1];
 const cost=Number(advertised?.costMultiplier??advertised?.cost);
 if(!advertised || !Number.isFinite(cost) || Math.abs(cost-modeCost(mode))>1e-9)return 'This purchase mode and cost are not enabled by the authenticated session.';
 return '';
}
let wagerPending=false;
export async function play(mode: Mode, bet: number, index: number): Promise<Round> {
 if(wagerPending)throw new Error('A wager request is already in progress.');
 if (replay() || (isBonusMode(mode) ? Boolean(bonusUnavailableReason(mode)) : !available(mode))) throw new Error('This mode is not enabled for this session.');
 if (demo()) {
  const pool = isBonusMode(mode)?bonusFixtures[mode]:fixtures[mode];
  const book = pool[index % pool.length];
  return { roundID: index+1, amount: bet*API_AMOUNT_MULTIPLIER, payout: bet*book.payoutMultiplier/100*API_AMOUNT_MULTIPLIER, payoutMultiplier: book.payoutMultiplier/100, mode, state: structuredClone(book.events), active: false };
 }
 wagerPending=true;
 try {
 const result = await requestBet({ rgsUrl: stateUrlDerived.rgsUrl(), sessionID: stateUrlDerived.sessionID(), currency: stateBet.currency, amount: bet, mode });
 if (result?.error || !result?.round || !result.balance) throw new Error('Wager response is incomplete. Reload to recover your session.');
 stateBet.balanceAmount = result.balance.amount/API_AMOUNT_MULTIPLIER;
 stateBet.currency = result.balance.currency;
 return result.round as Round;
 } finally {wagerPending=false;}
}
const completed = new Set<string>();
const recorded = new Set<string>();
// Wallet endpoints use sessionID. Optional bet/round IDs are not required by
// the response contract and may be opaque. A fresh response object is one local
// presentation, even if the same book/identifier appears on consecutive wagers.
const presentationKeys = new WeakMap<Round, string>();
let presentationSequence = 0;
function roundKey(round: Round) {
 let key=presentationKeys.get(round);
 if(!key){key=`${stateUrlDerived.sessionID()}:presentation:${++presentationSequence}`;presentationKeys.set(round,key);}
 return key;
}
export async function record(round: Round, index: number) {
 if (demo() || replay() || round.active === false) return;
 const key = `${roundKey(round)}:${index}`;
 if (recorded.has(key)) return;
 const response = await requestEndEvent({ rgsUrl: stateUrlDerived.rgsUrl(), sessionID: stateUrlDerived.sessionID(), eventIndex: index });
 if (response?.error) throw new Error('Could not save round progress. Reload to recover.');
 recorded.add(key);
}
export async function settle(round: Round) {
 // A 0x round is closed by the RGS itself: never send /wallet/end-round for it.
 if (demo() || replay() || round.active === false || round.payoutMultiplier === 0 || round.payout === 0) return;
 const key = roundKey(round);
 if (completed.has(key)) return;
 completed.add(key);
 const response = await requestEndRound({ rgsUrl: stateUrlDerived.rgsUrl(), sessionID: stateUrlDerived.sessionID() });
 if (response?.error || !response?.balance) throw new Error('Settlement is uncertain. Reload to recover; no new wager can be placed.');
 stateBet.balanceAmount = response.balance.amount/API_AMOUNT_MULTIPLIER;
}
export function validateWallet(round: Round, bet: number) {
 const decoded = decodeRound(round);
 if (!(Number.isFinite(bet) && bet > 0)) throw new Error('Missing original round stake.');
 if(round.amount!==undefined && (!Number.isSafeInteger(round.amount)||Math.abs(round.amount/API_AMOUNT_MULTIPLIER-bet)>1/API_AMOUNT_MULTIPLIER))throw new Error('Wallet stake does not match the original base bet.');
 if (round.payout !== undefined && Math.abs(round.payout/API_AMOUNT_MULTIPLIER-bet*decoded.payout/100) > 1/API_AMOUNT_MULTIPLIER) throw new Error('Wallet payout does not match the authoritative book.');
 return decoded;
}
