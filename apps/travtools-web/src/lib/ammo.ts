import { CORE_EQUIPMENT } from '../data/equipment';
import type { Weapon } from '../types';

export interface WeaponAmmoState {
  tracked: boolean;
  clipSize: number | null;
  clips: number;
  rounds: number;
  totalRounds: number | null;
}

export interface WeaponAmmoSpendResult {
  weapon: Weapon;
  before: WeaponAmmoState;
  after: WeaponAmmoState;
  requested: number;
  spent: number;
  insufficient: boolean;
}

function integerOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = integerOrNull(value);
  return parsed === null ? null : Math.max(0, parsed);
}

function positiveInteger(value: unknown): number | null {
  const parsed = integerOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function normalizedWeaponName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/\btl\s*\d+\b/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function exactWeaponName(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\(x\s*\d+\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseMagazineSize(magazine: string | null | undefined): number | null {
  if (!magazine || /unlimited/i.test(magazine)) return null;
  const match = magazine.match(/\d+/);
  return match ? positiveInteger(match[0]) : null;
}

export function coreWeaponMagazineSize(weapon: Pick<Weapon, 'name'>): number | null {
  const exactKey = exactWeaponName(weapon.name);
  const exactMatch = CORE_EQUIPMENT.find(item =>
    item.inventoryCategory === 'Weapon' &&
    item.magazine !== undefined &&
    exactWeaponName(item.name) === exactKey
  );
  if (exactMatch) return parseMagazineSize(exactMatch.magazine);

  const key = normalizedWeaponName(weapon.name);
  if (!key) return null;
  const match = CORE_EQUIPMENT.find(item =>
    item.inventoryCategory === 'Weapon' &&
    item.magazine !== undefined &&
    normalizedWeaponName(item.name) === key
  );
  return parseMagazineSize(match?.magazine);
}

export function weaponClipSize(weapon: Weapon): number | null {
  return positiveInteger(weapon.ammo_clip_size) ?? coreWeaponMagazineSize(weapon);
}

export function weaponAmmoState(weapon: Weapon): WeaponAmmoState {
  const clipSize = weaponClipSize(weapon);
  const hasExplicitAmmo = (
    weapon.ammo_clips !== undefined ||
    weapon.ammo_rounds !== undefined ||
    weapon.ammo_clip_size !== undefined
  ) && (
    weapon.ammo_clips !== null ||
    weapon.ammo_rounds !== null ||
    weapon.ammo_clip_size !== null
  );
  const tracked = hasExplicitAmmo || clipSize !== null;
  if (!tracked) {
    return { tracked: false, clipSize, clips: 0, rounds: 0, totalRounds: null };
  }

  const clips = nonNegativeInteger(weapon.ammo_clips) ?? 0;
  const rawRounds = nonNegativeInteger(weapon.ammo_rounds);
  const defaultRounds = clipSize ?? 0;
  const rounds = clipSize === null
    ? rawRounds ?? defaultRounds
    : Math.min(rawRounds ?? defaultRounds, clipSize);
  const totalRounds = clipSize === null ? null : rounds + (clips * clipSize);
  return { tracked, clipSize, clips, rounds, totalRounds };
}

export function weaponAmmoLabel(weapon: Weapon): string {
  const state = weaponAmmoState(weapon);
  if (!state.tracked) return '';
  const clipLabel = state.clips === 1 ? 'clip' : 'clips';
  const rounds = state.clipSize === null ? `${state.rounds} rnd` : `${state.rounds}/${state.clipSize} rnd`;
  return `${rounds} · ${state.clips} ${clipLabel}`;
}

export function weaponAmmoStateLabel(state: WeaponAmmoState): string {
  if (!state.tracked) return '';
  const clipLabel = state.clips === 1 ? 'clip' : 'clips';
  const rounds = state.clipSize === null ? `${state.rounds} rnd` : `${state.rounds}/${state.clipSize} rnd`;
  return `${rounds} · ${state.clips} ${clipLabel}`;
}

export function spendWeaponAmmo(weapon: Weapon, requestedAmount: number): WeaponAmmoSpendResult | null {
  const requested = Math.max(0, Math.trunc(requestedAmount));
  const before = weaponAmmoState(weapon);
  if (!before.tracked || requested <= 0) return null;

  let spent = 0;
  let nextRounds = before.rounds;
  let nextClips = before.clips;

  if (before.clipSize !== null && before.clipSize > 0) {
    const total = before.totalRounds ?? before.rounds;
    const remaining = Math.max(0, total - requested);
    spent = Math.min(requested, total);
    if (remaining <= 0) {
      nextRounds = 0;
      nextClips = 0;
    } else {
      nextClips = Math.floor((remaining - 1) / before.clipSize);
      nextRounds = remaining - (nextClips * before.clipSize);
    }
  } else {
    spent = Math.min(requested, before.rounds);
    nextRounds = Math.max(0, before.rounds - requested);
  }

  const nextWeapon: Weapon = {
    ...weapon,
    ammo_rounds: nextRounds,
    ammo_clips: nextClips,
  };
  const after = weaponAmmoState(nextWeapon);
  return {
    weapon: nextWeapon,
    before,
    after,
    requested,
    spent,
    insufficient: spent < requested,
  };
}
