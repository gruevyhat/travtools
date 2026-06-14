import { describe, expect, it } from 'vitest';
import { parseCsvRows } from '../lib/csv';
import { ROSTER_CSV_COLUMNS, rosterFromCsv, rosterToCsv } from '../lib/rosterCsv';
import type { Character } from '../types';

const baseCharacter: Character = {
  id: 'char-1',
  status: 'active',
  name: 'Ariadne Quinn',
  player: 'Graham',
  portrait_url: 'data:image/png;base64,abc',
  str: 8,
  dex: 9,
  end_stat: 7,
  int_stat: 10,
  edu: 11,
  soc: 6,
  psi: 4,
  chr: 5,
  mor: 6,
  lck: 7,
  str_cur: 6,
  dex_cur: null,
  end_cur: 5,
  psi_cur: 2,
  temp_mods: { str: -1, edu: 1 },
  profile_details: {
    species: 'Human',
    age: '38',
    gender: 'F',
    height: '1.72m',
    weight: '68kg',
    appearance: 'Sharp-eyed broker',
  },
  homeworld_details: {
    name: 'Drinax',
    sector: 'Trojan Reach',
    subsector: 'Sindal',
    location: '2223',
    uwp: 'D43679A-7',
    bases: null,
    trade_codes: 'Ni Po',
    travel_zone: 'Amber',
    gas_giant: 'Yes',
  },
  lifepath: [
    {
      term: 1,
      career: 'Merchant',
      assignment: 'Broker',
      survived: true,
      commissioned: false,
      advanced: true,
      rank: 'Factor',
      notes: 'Made a rival',
    },
  ],
  armour: [
    {
      worn: true,
      name: 'Flak Jacket',
      protection: 5,
      radiation: null,
      required_skill: null,
      quantity: 1,
      mass: 2,
      cost: 100,
    },
  ],
  augments: [{ name: 'Wafer Jack', notes: 'Used for trade sims', tech_level: 12, cost: 10000 }],
  personal_equipment: [
    { quantity: 2, name: 'Data Wafer', notes: 'Market intel', tech_level: 10, mass: null, cost: 5 },
  ],
  finances: {
    cash_on_hand: 12000,
    yearly_pension: null,
    monthly_salary: 4000,
    ship_operating_costs: 100000,
    monthly_debt_payments: null,
    monthly_living_cost: 1200,
    total_debts: 50000,
  },
  contacts: [
    {
      name: 'Vlen',
      gender_species: 'M Human',
      type: 'Contact',
      description: 'Port fixer',
      link: 'Drinax',
      alive: true,
    },
  ],
  background: {
    personality_descriptors: 'Calculating, loyal',
    background_story: 'Won passage out of poverty.',
    hobbies: 'Cards',
  },
  career: 'Merchant',
  rank: 'Factor',
  homeworld: 'Drinax',
  skills: [{ name: 'Broker', level: 2 }, { name: 'Admin', level: 1 }],
  psionic_talents: [{ name: 'Telepathy', level: 0 }],
  weapons: [
    {
      name: 'Laser Pistol',
      skill: 'Gun Combat (Energy)',
      range: '20m',
      damage: '3D+3',
      traits: 'Zero-G',
      quantity: 1,
      mass: 1,
      cost: 2000,
      ammo_clips: 3,
      ammo_rounds: 12,
      ammo_clip_size: 12,
    },
  ],
  notes: 'Keeps the books',
  created_at: '2026-06-01T12:00:00Z',
};

describe('rosterToCsv', () => {
  it('exports one row per character with expanded detail columns', () => {
    const csv = rosterToCsv([
      baseCharacter,
      { ...baseCharacter, id: 'char-2', name: 'Bex', skills: [], psionic_talents: [] },
    ]);
    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(ROSTER_CSV_COLUMNS.map(column => column.header));
    expect(rows[1][rows[0].indexOf('Status')]).toBe('active');
    expect(rows[1][rows[0].indexOf('Name')]).toBe('Ariadne Quinn');
    expect(rows[2][rows[0].indexOf('Name')]).toBe('Bex');
  });

  it('includes imported profile, homeworld, lifepath, equipment, finances, contact, background, and weapon details', () => {
    const [header, row] = parseCsvRows(rosterToCsv([baseCharacter]));
    const cell = (name: string) => row[header.indexOf(name)];

    expect(JSON.parse(cell('Profile Details JSON'))).toMatchObject({ species: 'Human', appearance: 'Sharp-eyed broker' });
    expect(JSON.parse(cell('Homeworld Details JSON'))).toMatchObject({ name: 'Drinax', uwp: 'D43679A-7' });
    expect(JSON.parse(cell('Lifepath JSON'))[0]).toMatchObject({ career: 'Merchant', rank: 'Factor' });
    expect(JSON.parse(cell('Armour JSON'))[0]).toMatchObject({ name: 'Flak Jacket', protection: 5 });
    expect(JSON.parse(cell('Augments JSON'))[0]).toMatchObject({ name: 'Wafer Jack' });
    expect(JSON.parse(cell('Personal Equipment JSON'))[0]).toMatchObject({ name: 'Data Wafer' });
    expect(JSON.parse(cell('Finances JSON'))).toMatchObject({ cash_on_hand: 12000, total_debts: 50000 });
    expect(JSON.parse(cell('Contacts JSON'))[0]).toMatchObject({ name: 'Vlen', alive: true });
    expect(JSON.parse(cell('Background JSON'))).toMatchObject({ hobbies: 'Cards' });
    expect(JSON.parse(cell('Weapons JSON'))[0]).toMatchObject({ name: 'Laser Pistol', ammo_clips: 3 });
    expect(cell('Skills Summary')).toBe('Broker-2, Admin-1');
    expect(cell('Psionic Talents Summary')).toBe('Telepathy-0');
  });

  it('parses exported CSV back into full character payloads for upload', () => {
    const csv = rosterToCsv([{ ...baseCharacter, status: 'deceased', notes: 'Line 1\nLine 2' }]);
    const [character] = rosterFromCsv(csv);

    expect(character.id).toBe('char-1');
    expect(character.status).toBe('deceased');
    expect(character.name).toBe('Ariadne Quinn');
    expect(character.notes).toBe('Line 1\nLine 2');
    expect(character.skills).toEqual([{ name: 'Broker', level: 2 }, { name: 'Admin', level: 1 }]);
    expect(character.psionic_talents).toEqual([{ name: 'Telepathy', level: 0 }]);
    expect(character.profile_details).toMatchObject({ species: 'Human' });
    expect(character.weapons?.[0]).toMatchObject({ name: 'Laser Pistol', ammo_rounds: 12 });
  });

  it('parses older summary roster CSV rows when JSON detail columns are absent', () => {
    const [character] = rosterFromCsv([
      'Name,Player,Career,Rank,Homeworld,STR,DEX,END,INT,EDU,SOC,PSI,CHR,MOR,LCK,Skills,PsionicTalents,Notes,Status',
      'Vera,Graham,Scout,Senior Scout,Regina,7,8,9,10,11,12,,,,,Pilot-1,Awareness-0,Ready,deceased',
    ].join('\n'));

    expect(character.status).toBe('deceased');
    expect(character.str).toBe(7);
    expect(character.skills).toEqual([{ name: 'Pilot', level: 1 }]);
    expect(character.psionic_talents).toEqual([{ name: 'Awareness', level: 0 }]);
  });
});
