import { describe, expect, it } from 'vitest';
import { spendWeaponAmmo, weaponAmmoLabel, weaponAmmoState } from '../lib/ammo';
import type { Weapon } from '../types';

describe('weapon ammo tracking', () => {
  it('infers core magazine size for known weapons', () => {
    const weapon: Weapon = {
      name: 'Autopistol',
      skill: 'Gun Combat (Slug)',
      range: '10m',
      damage: '3D-3',
      traits: '',
    };

    expect(weaponAmmoState(weapon)).toMatchObject({
      tracked: true,
      clipSize: 15,
      rounds: 15,
      clips: 0,
      totalRounds: 15,
    });
    expect(weaponAmmoLabel(weapon)).toBe('15/15 rnd · 0 clips');
  });

  it('uses exact TL weapon names before falling back to a generic core match', () => {
    const weapon: Weapon = {
      name: 'Rocket Launcher (TL8)',
      skill: 'Heavy Weapons (Man-Portable)',
      range: '200m',
      damage: '5D',
      traits: 'Blast 6, Scope, Smart',
    };

    expect(weaponAmmoState(weapon).clipSize).toBe(2);
  });

  it('spends the requested rounds from the current clip', () => {
    const weapon: Weapon = {
      name: 'Autopistol',
      skill: 'Gun Combat (Slug)',
      range: '10m',
      damage: '3D-3',
      traits: '',
      ammo_rounds: 15,
      ammo_clips: 2,
      ammo_clip_size: 15,
    };

    const result = spendWeaponAmmo(weapon, 3);

    expect(result?.spent).toBe(3);
    expect(result?.insufficient).toBe(false);
    expect(result?.weapon.ammo_rounds).toBe(12);
    expect(result?.weapon.ammo_clips).toBe(2);
  });

  it('rolls into spare clips when the spend crosses a clip boundary', () => {
    const weapon: Weapon = {
      name: 'Autopistol',
      skill: 'Gun Combat (Slug)',
      range: '10m',
      damage: '3D-3',
      traits: '',
      ammo_rounds: 2,
      ammo_clips: 2,
      ammo_clip_size: 15,
    };

    const result = spendWeaponAmmo(weapon, 6);

    expect(result?.spent).toBe(6);
    expect(result?.weapon.ammo_rounds).toBe(11);
    expect(result?.weapon.ammo_clips).toBe(1);
  });

  it('does not track weapons without a magazine or explicit ammo fields', () => {
    const weapon: Weapon = {
      name: 'Unarmed',
      skill: 'Melee (Unarmed)',
      range: 'Melee',
      damage: '1D+STR DM',
      traits: '',
    };

    expect(weaponAmmoState(weapon).tracked).toBe(false);
    expect(spendWeaponAmmo(weapon, 1)).toBeNull();
  });
});
