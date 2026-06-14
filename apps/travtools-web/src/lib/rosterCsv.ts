import type { Character, CharacterStatus } from '../types';
import { csvRow, parseCsvRows } from './csv';
import { parseSkillsCSV, parseTalentsCSV } from './traveller';

type CsvValue = string | number | boolean | null | undefined;
export type RosterCsvCharacter = Partial<Character> & Pick<Character, 'name'>;

interface CharacterCsvColumn {
  header: string;
  value: (character: Character) => CsvValue;
}

function jsonCell(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function skillSummary(character: Character): string {
  return character.skills.map(skill => `${skill.name}-${skill.level}`).join(', ');
}

function talentSummary(character: Character): string {
  return character.psionic_talents.map(talent => `${talent.name}-${talent.level}`).join(', ');
}

export const ROSTER_CSV_COLUMNS: CharacterCsvColumn[] = [
  { header: 'ID', value: c => c.id },
  { header: 'Status', value: c => c.status ?? 'active' },
  { header: 'Name', value: c => c.name },
  { header: 'Player', value: c => c.player },
  { header: 'Portrait URL', value: c => c.portrait_url },
  { header: 'Career', value: c => c.career },
  { header: 'Rank', value: c => c.rank },
  { header: 'Homeworld', value: c => c.homeworld },
  { header: 'STR', value: c => c.str },
  { header: 'STR Current', value: c => c.str_cur },
  { header: 'DEX', value: c => c.dex },
  { header: 'DEX Current', value: c => c.dex_cur },
  { header: 'END', value: c => c.end_stat },
  { header: 'END Current', value: c => c.end_cur },
  { header: 'INT', value: c => c.int_stat },
  { header: 'EDU', value: c => c.edu },
  { header: 'SOC', value: c => c.soc },
  { header: 'PSI', value: c => c.psi },
  { header: 'PSI Current', value: c => c.psi_cur },
  { header: 'CHR', value: c => c.chr },
  { header: 'MOR', value: c => c.mor },
  { header: 'LCK', value: c => c.lck },
  { header: 'Temp Mods JSON', value: c => jsonCell(c.temp_mods) },
  { header: 'Profile Details JSON', value: c => jsonCell(c.profile_details) },
  { header: 'Homeworld Details JSON', value: c => jsonCell(c.homeworld_details) },
  { header: 'Lifepath JSON', value: c => jsonCell(c.lifepath) },
  { header: 'Armour JSON', value: c => jsonCell(c.armour) },
  { header: 'Augments JSON', value: c => jsonCell(c.augments) },
  { header: 'Personal Equipment JSON', value: c => jsonCell(c.personal_equipment) },
  { header: 'Finances JSON', value: c => jsonCell(c.finances) },
  { header: 'Contacts JSON', value: c => jsonCell(c.contacts) },
  { header: 'Background JSON', value: c => jsonCell(c.background) },
  { header: 'Skills Summary', value: skillSummary },
  { header: 'Skills JSON', value: c => jsonCell(c.skills) },
  { header: 'Psionic Talents Summary', value: talentSummary },
  { header: 'Psionic Talents JSON', value: c => jsonCell(c.psionic_talents) },
  { header: 'Weapons JSON', value: c => jsonCell(c.weapons) },
  { header: 'Notes', value: c => c.notes },
  { header: 'Created At', value: c => c.created_at },
];

export function rosterToCsv(characters: Character[]): string {
  const header = csvRow(ROSTER_CSV_COLUMNS.map(column => column.header));
  const rows = characters.map(character =>
    csvRow(ROSTER_CSV_COLUMNS.map(column => column.value(character)))
  );
  return [header, ...rows].join('\n');
}

function textCell(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function numberCell(value: string | undefined): number | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusCell(value: string | undefined): CharacterStatus {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'deceased' || normalized === 'dead' || normalized === 'killed'
    ? 'deceased'
    : 'active';
}

function jsonCellValue<T>(value: string | undefined, fallback: T): T {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export function rosterFromCsv(csv: string): RosterCsvCharacter[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];
  const headers = rows[0].map(header => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
  const get = (row: string[], header: string): string | undefined => row[headerIndex.get(header.toLowerCase()) ?? -1];

  return rows.slice(1).map(row => {
    const skillsSummary = get(row, 'Skills Summary') ?? get(row, 'Skills') ?? '';
    const talentsSummary = get(row, 'Psionic Talents Summary') ?? get(row, 'PsionicTalents') ?? '';
    const id = textCell(get(row, 'ID'));
    const created_at = textCell(get(row, 'Created At'));
    const character: RosterCsvCharacter = {
      name: textCell(get(row, 'Name')) ?? 'Unknown',
      status: statusCell(get(row, 'Status')),
      player: textCell(get(row, 'Player')),
      portrait_url: textCell(get(row, 'Portrait URL')),
      career: textCell(get(row, 'Career')),
      rank: textCell(get(row, 'Rank')),
      homeworld: textCell(get(row, 'Homeworld')),
      str: numberCell(get(row, 'STR')),
      str_cur: numberCell(get(row, 'STR Current')),
      dex: numberCell(get(row, 'DEX')),
      dex_cur: numberCell(get(row, 'DEX Current')),
      end_stat: numberCell(get(row, 'END')),
      end_cur: numberCell(get(row, 'END Current')),
      int_stat: numberCell(get(row, 'INT')),
      edu: numberCell(get(row, 'EDU')),
      soc: numberCell(get(row, 'SOC')),
      psi: numberCell(get(row, 'PSI')),
      psi_cur: numberCell(get(row, 'PSI Current')),
      chr: numberCell(get(row, 'CHR')),
      mor: numberCell(get(row, 'MOR')),
      lck: numberCell(get(row, 'LCK')),
      temp_mods: jsonCellValue(get(row, 'Temp Mods JSON'), {}),
      profile_details: jsonCellValue(get(row, 'Profile Details JSON'), {}),
      homeworld_details: jsonCellValue(get(row, 'Homeworld Details JSON'), {}),
      lifepath: jsonCellValue(get(row, 'Lifepath JSON'), []),
      armour: jsonCellValue(get(row, 'Armour JSON'), []),
      augments: jsonCellValue(get(row, 'Augments JSON'), []),
      personal_equipment: jsonCellValue(get(row, 'Personal Equipment JSON'), []),
      finances: jsonCellValue(get(row, 'Finances JSON'), {}),
      contacts: jsonCellValue(get(row, 'Contacts JSON'), []),
      background: jsonCellValue(get(row, 'Background JSON'), {}),
      skills: jsonCellValue(get(row, 'Skills JSON'), parseSkillsCSV(skillsSummary)),
      psionic_talents: jsonCellValue(get(row, 'Psionic Talents JSON'), parseTalentsCSV(talentsSummary)),
      weapons: jsonCellValue(get(row, 'Weapons JSON'), []),
      notes: textCell(get(row, 'Notes')),
    };
    if (id) character.id = id;
    if (created_at) character.created_at = created_at;
    return character;
  }).filter(character => character.name.trim() !== '');
}
