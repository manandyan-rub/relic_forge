import config from './bonus-config.json';
import { tr } from './i18n';
import type { BonusMode, BonusVariant, Mode, World } from './types';
export const bonusConfig = config;
export const bonusModes = Object.keys(config) as BonusMode[];
export const isBonusMode = (mode: string): mode is BonusMode => Object.hasOwn(config,mode);
export const modeCost = (mode: Mode) => isBonusMode(mode) ? config[mode].costMultiplier : 1;
export const modeWorld = (mode: Mode): World => isBonusMode(mode) ? config[mode].world as World : mode;
export const variantTitle = (variant: BonusVariant) => tr(`${variant[0]}${variant.slice(1).toLowerCase()} Bonus`);
