import { Character, PsionicTalent, Skill, Weapon } from '../types';

export type CharStat = 'str' | 'dex' | 'end_stat' | 'int_stat' | 'edu' | 'soc' | 'psi' | 'chr' | 'mor' | 'lck';

export const STAT_LABELS: Record<CharStat, string> = {
  str: 'STR', dex: 'DEX', end_stat: 'END',
  int_stat: 'INT', edu: 'EDU', soc: 'SOC', psi: 'PSI',
  chr: 'CHR', mor: 'MOR', lck: 'LCK',
};

// Traveller 2022 characteristic DM table (p.7)
export function statDM(n: number | null): number {
  if (n === null || n <= 0) return -3;
  if (n <= 2) return -2;
  if (n <= 5) return -1;
  if (n <= 8) return 0;
  if (n <= 11) return 1;
  if (n <= 14) return 2;
  return 3;
}

export function toHex(n: number | null | undefined): string {
  if (n == null) return '?';
  if (n >= 10) return String.fromCharCode(55 + n); // A=10 … F=15
  return String(n);
}

export function upp(char: Character): string {
  const core = [char.str, char.dex, char.end_stat, char.int_stat, char.edu, char.soc]
    .map(toHex).join('');
  const expanded = [char.psi, char.chr, char.mor, char.lck]
    .filter((v): v is number => v != null)
    .map(toHex).join('');
  return expanded ? `${core}-${expanded}` : core;
}

// Maps skill names (including parenthesized specialties) to governing characteristic.
// Follows Traveller 2022 Core Rulebook skill descriptions.
export const SKILL_CHAR: Record<string, CharStat> = {
  Admin: 'edu', Advocate: 'edu',
  Animals: 'end_stat', 'Animals (Handling)': 'end_stat', 'Animals (Training)': 'int_stat', 'Animals (Veterinary)': 'int_stat',
  Art: 'int_stat', Astrogation: 'int_stat',
  Athletics: 'str', 'Athletics (Dexterity)': 'dex', 'Athletics (Endurance)': 'end_stat', 'Athletics (Strength)': 'str',
  Broker: 'int_stat',
  Carouse: 'soc',
  Deception: 'int_stat', Diplomat: 'soc',
  Drive: 'dex', 'Drive (Hovercraft)': 'dex', 'Drive (Mole)': 'dex',
  'Drive (Track)': 'dex', 'Drive (Walker)': 'dex', 'Drive (Wheel)': 'dex',
  Electronics: 'edu', 'Electronics (Comms)': 'edu', 'Electronics (Computers)': 'edu',
  'Electronics (Remote Ops)': 'dex', 'Electronics (Sensors)': 'int_stat',
  Engineer: 'edu', 'Engineer (J-Drive)': 'edu', 'Engineer (Life Support)': 'edu',
  'Engineer (M-Drive)': 'edu', 'Engineer (Power)': 'edu',
  Explosives: 'edu',
  Flyer: 'dex', 'Flyer (Airship)': 'dex', 'Flyer (Grav)': 'dex',
  'Flyer (Ornithopter)': 'dex', 'Flyer (Rotor)': 'dex', 'Flyer (Wing)': 'dex',
  Gambler: 'int_stat',
  'Gun Combat': 'dex', 'Gun Combat (Archaic)': 'dex', 'Gun Combat (Energy)': 'dex', 'Gun Combat (Slug)': 'dex',
  Gunner: 'dex', 'Gunner (Capital)': 'dex', 'Gunner (Ortillery)': 'dex',
  'Gunner (Screen)': 'dex', 'Gunner (Turret)': 'dex',
  'Heavy Weapons': 'dex', 'Heavy Weapons (Artillery)': 'dex',
  'Heavy Weapons (Man-Portable)': 'dex', 'Heavy Weapons (Vehicle)': 'dex',
  Investigate: 'int_stat',
  Language: 'int_stat', Languages: 'int_stat',
  Leadership: 'soc',
  Mechanic: 'edu', Medic: 'edu',
  Melee: 'str', 'Melee (Blade)': 'dex', 'Melee (Bludgeon)': 'str',
  'Melee (Natural)': 'str', 'Melee (Unarmed)': 'str',
  Navigation: 'int_stat',
  Persuade: 'soc',
  Pilot: 'dex', 'Pilot (Capital Ships)': 'dex', 'Pilot (Small Craft)': 'dex', 'Pilot (Spacecraft)': 'dex',
  Profession: 'int_stat',
  Recon: 'int_stat',
  Science: 'edu', 'Science (Archaeology)': 'edu', 'Science (Astronomy)': 'edu',
  'Science (Biology)': 'edu', 'Science (Chemistry)': 'edu', 'Science (Cosmology)': 'edu',
  'Science (Cybernetics)': 'edu', 'Science (Economics)': 'int_stat',
  'Science (Genetics)': 'edu', 'Science (History)': 'int_stat',
  'Science (Linguistics)': 'int_stat', 'Science (Philosophy)': 'int_stat',
  'Science (Physics)': 'edu', 'Science (Planetology)': 'edu',
  'Science (Psionicology)': 'int_stat', 'Science (Psychology)': 'int_stat',
  'Science (Robotics)': 'edu', 'Science (Sophontology)': 'int_stat', 'Science (Xenology)': 'int_stat',
  Seafarer: 'dex', 'Seafarer (Ocean Ship)': 'dex', 'Seafarer (Personal)': 'dex',
  'Seafarer (Sail)': 'dex', 'Seafarer (Sails)': 'dex', 'Seafarer (Submarine)': 'dex',
  Stealth: 'dex', Steward: 'soc', Streetwise: 'int_stat', Survival: 'end_stat',
  Tactics: 'int_stat', 'Tactics (Military)': 'int_stat', 'Tactics (Naval)': 'int_stat',
  'Vacc Suit': 'dex',
};

// Returns the governing characteristic for a skill, trying exact match then parent skill.
export function skillChar(name: string): CharStat | null {
  if (SKILL_CHAR[name]) return SKILL_CHAR[name];
  const parent = name.replace(/\s*\(.*\)/, '').trim();
  return SKILL_CHAR[parent] ?? null;
}

export function parseSkillsCSV(raw: string): Skill[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const match = s.match(/^(.+?)-(\d+)$/);
    if (match) return { name: match[1].trim(), level: parseInt(match[2]) };
    return { name: s, level: 0 };
  });
}

export function parseTalentsCSV(raw: string): PsionicTalent[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const match = s.match(/^(.+?)-(\d+)$/);
    if (match) return { name: match[1].trim(), level: parseInt(match[2]) };
    return { name: s, level: 0 };
  });
}

export type CharFormBase = Omit<Character, 'id' | 'created_at'>;

export function parseCSV(text: string): CharFormBase[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur); cur = ''; }
      else cur += ch;
    }
    values.push(cur);
    const get = (key: string) => values[headers.indexOf(key)]?.trim() ?? '';
    const getAny = (...keys: string[]) => keys.map(get).find(Boolean) ?? '';
    const num = (key: string) => { const v = parseInt(get(key)); return isNaN(v) ? null : v; };
    const strVal = num('str'), dexVal = num('dex'), endVal = num('end'), psiVal = num('psi');
    return {
      name: get('name') || 'Unknown',
      player: get('player') || null,
      portrait_url: getAny('portrait_url', 'portraiturl', 'portrait url') || null,
      str: strVal, dex: dexVal, end_stat: endVal,
      int_stat: num('int'), edu: num('edu'), soc: num('soc'),
      psi: psiVal,
      chr: num('chr'), mor: num('mor'), lck: num('lck'),
      str_cur: strVal, dex_cur: dexVal, end_cur: endVal, psi_cur: psiVal,
      temp_mods: {},
      profile_details: {},
      homeworld_details: {},
      lifepath: [],
      armour: [],
      augments: [],
      personal_equipment: [],
      finances: {},
      contacts: [],
      background: {},
      career: get('career') || null,
      rank: get('rank') || null,
      homeworld: get('homeworld') || null,
      skills: parseSkillsCSV(get('skills')),
      psionic_talents: parseTalentsCSV(get('psionictalents')),
      weapons: [{ name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' }] as Weapon[],
      notes: get('notes') || null,
    };
  });
}

// Parses a weapon damage expression like "4D", "3D-3", "2D+2", "1D+STR DM".
// STR DM notation is stripped — for melee weapons the caller adds STR DM separately.
export function parseDamageExpr(expr: string): { dice: number; constant: number } {
  const clean = expr.replace(/[+ ]*str dm/gi, '').trim();
  const match = clean.match(/^(\d+)D([+-]\d+)?$/i);
  if (!match) return { dice: 1, constant: 0 };
  return { dice: parseInt(match[1]), constant: match[2] ? parseInt(match[2]) : 0 };
}

export const CSV_TEMPLATE =
  'Name,STR,DEX,END,INT,EDU,SOC,PSI,CHR,MOR,LCK,Career,Rank,Homeworld,PortraitUrl,Skills,PsionicTalents,Notes\n' +
  'Example,9,11,11,8,10,4,0,,,,Rogue,Thief,Regina,,"Gun Combat (Slug)-3,Recon-2","Awareness-1,Telepathy-0",Notes here\n';
