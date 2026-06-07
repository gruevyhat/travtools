import * as XLSX from 'xlsx';
import { CharFormBase } from './traveller';
import {
  ArmourItem, CharacterAugment, CharacterBackground, CharacterContact,
  CharacterFinances, CharacterProfileDetails, HomeworldDetails, LifepathTerm,
  PersonalEquipmentItem, PsionicTalent, Skill, Weapon,
} from '../types';

const PSIONIC_NAMES = new Set(['Awareness', 'Clairvoyance', 'Telekinesis', 'Telepathy', 'Teleportation']);

const STAT_ALIASES: Record<string, keyof Pick<CharFormBase,
  'str'|'dex'|'end_stat'|'int_stat'|'edu'|'soc'|'psi'|'chr'|'mor'|'lck'>> = {
  STR: 'str', DEX: 'dex', END: 'end_stat', INT: 'int_stat',
  EDU: 'edu', SOC: 'soc', PSI: 'psi',
  CHA: 'chr', CHR: 'chr', CHARISMA: 'chr',
  MOR: 'mor', MORALE: 'mor',
  LUC: 'lck', LCK: 'lck', LUCK: 'lck',
};

const UNARMED: Weapon = { name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v));
  return isNaN(n) ? null : n;
}

function decimal(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === '--') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = str(v).toLowerCase();
  if (s === 'true' || s === 'yes' || s === 'y') return true;
  if (s === 'false' || s === 'no' || s === 'n') return false;
  return null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function clean(v: unknown): string | null {
  const s = str(v);
  return s && s !== '--' && s !== '0' ? s : null;
}

function rowsFrom(ws: XLSX.WorkSheet | undefined): unknown[][] {
  return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) : [];
}

function rowHas(row: unknown[], label: string): boolean {
  const target = label.toLowerCase();
  return row.some(c => str(c).toLowerCase() === target);
}

function findHeaderRow(rows: unknown[][], labels: string[]): number {
  return rows.findIndex(row => labels.every(label => rowHas(row, label)));
}

function colIndex(row: unknown[], label: string): number {
  const target = label.toLowerCase();
  return row.findIndex(c => str(c).toLowerCase() === target);
}

function valueBelowLabel(rows: unknown[][], label: string, maxRows = 12): string | null {
  const target = label.toLowerCase();
  for (let ri = 0; ri < Math.min(rows.length - 1, maxRows); ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < row.length; ci++) {
      if (str(row[ci]).toLowerCase() === target) return clean(rows[ri + 1]?.[ci]);
    }
  }
  return null;
}

function valueRightOfLabel(rows: unknown[][], label: string): unknown {
  const target = label.toLowerCase();
  for (const row of rows) {
    for (let ci = 0; ci < row.length; ci++) {
      if (str(row[ci]).toLowerCase() !== target) continue;
      for (let vi = ci + 1; vi < row.length; vi++) {
        if (str(row[vi]) !== '') return row[vi];
      }
    }
  }
  return null;
}

function valueNearLabel(rows: unknown[][], label: string): string | null {
  const target = label.toLowerCase();
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < row.length; ci++) {
      if (!str(row[ci]).toLowerCase().includes(target)) continue;
      for (let vi = ci + 1; vi < Math.min(row.length, ci + 5); vi++) {
        const value = clean(row[vi]);
        if (value) return value;
      }
      for (let vr = ri + 1; vr < Math.min(rows.length, ri + 4); vr++) {
        const value = clean(rows[vr]?.[ci]);
        if (value) return value;
      }
    }
  }
  return null;
}

function extractProfileDetails(rows: unknown[][]): CharacterProfileDetails {
  return {
    species: valueBelowLabel(rows, 'Race/Species'),
    age: valueBelowLabel(rows, 'Age'),
    gender: valueBelowLabel(rows, 'Gender'),
    height: valueBelowLabel(rows, 'Height'),
    weight: valueBelowLabel(rows, 'Weight'),
    appearance: valueBelowLabel(rows, 'Basic Appearance'),
  };
}

function extractHomeworldDetails(rows: unknown[][]): HomeworldDetails {
  const homeRow = rows.findIndex(row => row.some(c => str(c).toUpperCase() === 'HOMEWORLD'));
  if (homeRow < 0) return {};

  for (let ri = homeRow + 1; ri < Math.min(homeRow + 4, rows.length - 1); ri++) {
    const header = rows[ri];
    const values = rows[ri + 1];
    if (!rowHas(header, 'Name')) continue;
    return {
      name: clean(values[colIndex(header, 'Name')]),
      sector: clean(values[colIndex(header, 'Sector')]),
      subsector: clean(values[colIndex(header, 'Subsector')]),
      location: clean(values[colIndex(header, 'Location')]),
      uwp: clean(values[colIndex(header, 'UPP/UWP')]),
      bases: clean(values[colIndex(header, 'Bases')]),
      trade_codes: clean(values[colIndex(header, 'Trade Codes')]),
      travel_zone: clean(values[colIndex(header, 'Travel')]),
      gas_giant: clean(values[colIndex(header, 'Gas G.')]),
    };
  }

  return {};
}

function extractLifepath(rows: unknown[][]): LifepathTerm[] {
  const headerRow = findHeaderRow(rows, ['Term', 'Career']);
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const termCol = colIndex(header, 'Term');
  const careerCol = colIndex(header, 'Career');
  const assignmentCol = colIndex(header, 'Assignment');
  const survivedCol = colIndex(header, 'Surv.?');
  const commissionedCol = colIndex(header, 'Com.?');
  const advancedCol = colIndex(header, 'Adv.?');
  const rankCol = colIndex(header, 'Rank');
  const notesCol = header.findIndex(c => str(c).toLowerCase().includes('events'));

  const terms: LifepathTerm[] = [];
  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const term = num(row[termCol]);
    if (term === null) break;
    const career = clean(row[careerCol]);
    const notes = notesCol >= 0 ? clean(row[notesCol]) : null;
    if (!career && !notes) continue;
    terms.push({
      term,
      career,
      assignment: assignmentCol >= 0 ? clean(row[assignmentCol]) : null,
      survived: survivedCol >= 0 ? bool(row[survivedCol]) : null,
      commissioned: commissionedCol >= 0 ? bool(row[commissionedCol]) : null,
      advanced: advancedCol >= 0 ? bool(row[advancedCol]) : null,
      rank: rankCol >= 0 ? clean(row[rankCol]) : null,
      notes,
    });
  }
  return terms;
}

// Extract career title from lifepath rows (Profile sheet)
function extractCareerInfo(rows: unknown[][]): { career: string | null; rank: string | null; homeworld: string | null } {
  let termHeaderRow = -1;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => str(c).toLowerCase() === 'term') && row.some(c => str(c).toLowerCase() === 'career')) {
      termHeaderRow = ri;
      break;
    }
  }

  let career: string | null = null;
  let rank: string | null = null;
  let homeworld: string | null = null;

  for (let ri = 0; ri < rows.length; ri++) {
    if (rows[ri].some(c => str(c) === 'HOMEWORLD')) {
      for (let ni = ri + 1; ni < Math.min(ri + 4, rows.length); ni++) {
        const nameRow = rows[ni];
        if (nameRow.some(c => str(c) === 'Name')) {
          const nameColIdx = nameRow.findIndex(c => str(c) === 'Name');
          const dataRow = rows[ni + 1];
          if (dataRow) homeworld = str(dataRow[nameColIdx]) || null;
          break;
        }
      }
      break;
    }
  }

  if (termHeaderRow < 0) return { career, rank, homeworld };

  const hrow = rows[termHeaderRow];
  const careerColIdx = hrow.findIndex(c => str(c).toLowerCase() === 'career');
  const rankColIdx = hrow.findIndex(c => str(c).toLowerCase() === 'rank');

  const careers: Array<{ career: string; rank: string }> = [];
  for (let ri = termHeaderRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const termNum = num(row[hrow.findIndex(c => str(c).toLowerCase() === 'term')]);
    if (termNum === null) break;
    const c = str(row[careerColIdx]);
    const r = str(row[rankColIdx]);
    if (c) careers.push({ career: c, rank: r });
  }

  if (careers.length > 0) {
    const last = careers[careers.length - 1];
    career = last.career;
    rank = last.rank || null;
  }

  return { career, rank, homeworld };
}

function extractArmour(rows: unknown[][]): ArmourItem[] {
  const headerRow = findHeaderRow(rows, ['Worn', 'Armour Type']);
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const wornCol = colIndex(header, 'Worn');
  const typeCol = colIndex(header, 'Armour Type');
  const protectionCol = colIndex(header, 'Protection');
  const radCol = colIndex(header, 'Rad');
  const skillCol = colIndex(header, 'Required Skill');
  const armour: ArmourItem[] = [];

  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => str(c).toUpperCase() === 'AUGMENTS')) break;
    const fallbackName = typeCol >= 0 ? clean(row[typeCol + 4]) : null;
    const name = (typeCol >= 0 ? clean(row[typeCol]) : null) ?? fallbackName;
    if (!name || name.toLowerCase().includes('total armour value')) continue;
    armour.push({
      worn: wornCol >= 0 ? bool(row[wornCol]) : null,
      name,
      protection: protectionCol >= 0 ? (num(row[protectionCol]) ?? num(row[protectionCol + 7])) : null,
      radiation: radCol >= 0 ? num(row[radCol]) : null,
      required_skill: skillCol >= 0 ? clean(row[skillCol]) : null,
    });
  }

  return armour;
}

function extractAugments(rows: unknown[][]): CharacterAugment[] {
  const headerRow = findHeaderRow(rows, ['Augment', 'Improvement/Notes']);
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const nameCol = colIndex(header, 'Augment');
  const notesCol = colIndex(header, 'Improvement/Notes');
  const tlCol = colIndex(header, 'TL');
  const costCol = colIndex(header, 'Cost');
  const augments: CharacterAugment[] = [];

  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => str(c).toUpperCase() === 'EQUIPMENT ON PERSON')) break;
    const name = clean(row[nameCol]);
    const notes = notesCol >= 0 ? clean(row[notesCol]) : null;
    if (!name && !notes) continue;
    augments.push({
      name: name ?? 'Augment',
      notes,
      tech_level: tlCol >= 0 ? num(row[tlCol]) : null,
      cost: costCol >= 0 ? decimal(row[costCol]) : null,
    });
  }

  return augments;
}

function extractPersonalEquipment(rows: unknown[][]): PersonalEquipmentItem[] {
  const headerRow = findHeaderRow(rows, ['Item', 'Notes', 'Mass', 'Cost']);
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const qtyCol = colIndex(header, '#');
  const itemCol = colIndex(header, 'Item');
  const notesCol = colIndex(header, 'Notes');
  const tlCol = colIndex(header, 'TL');
  const massCol = colIndex(header, 'Mass');
  const costCol = colIndex(header, 'Cost');
  const equipment: PersonalEquipmentItem[] = [];

  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => str(c).toUpperCase() === 'SAVINGS & ASSETS')) break;
    const name = clean(row[itemCol]);
    if (!name) continue;
    equipment.push({
      quantity: qtyCol >= 0 ? num(row[qtyCol]) : null,
      name,
      notes: notesCol >= 0 ? clean(row[notesCol]) : null,
      tech_level: tlCol >= 0 ? num(row[tlCol]) : null,
      mass: massCol >= 0 ? decimal(row[massCol]) : null,
      cost: costCol >= 0 ? decimal(row[costCol]) : null,
    });
  }

  return equipment;
}

function extractFinances(rows: unknown[][]): CharacterFinances {
  return {
    cash_on_hand: decimal(valueRightOfLabel(rows, 'Cash On Hand')),
    yearly_pension: decimal(valueRightOfLabel(rows, 'Yearly Pension')),
    monthly_salary: decimal(valueRightOfLabel(rows, 'Monthly Salary')),
    ship_operating_costs: decimal(valueRightOfLabel(rows, 'Ship Operating Costs')),
    monthly_debt_payments: decimal(valueRightOfLabel(rows, 'Monthly Debt Payments')),
    monthly_living_cost: decimal(valueRightOfLabel(rows, 'Monthly Living Cost')),
    total_debts: decimal(valueRightOfLabel(rows, 'Total Debts')),
  };
}

function extractBackground(rows: unknown[][]): CharacterBackground {
  return {
    short_term_goals: valueNearLabel(rows, 'Short-Term'),
    long_term_goals: valueNearLabel(rows, 'Long-Term'),
    good_traits: valueNearLabel(rows, 'Good'),
    bad_traits: valueNearLabel(rows, 'Bad'),
    greatest_strength: valueNearLabel(rows, 'Greatest Strength'),
    greatest_weakness: valueNearLabel(rows, 'Greatest Weakness'),
    mannerisms: valueNearLabel(rows, 'Mannerisms'),
    speech_quirks: valueNearLabel(rows, 'Conversation'),
    typical_mood: valueNearLabel(rows, 'Typical Mood'),
    sense_of_humour: valueNearLabel(rows, 'Sense of Humour'),
    greatest_joys: valueNearLabel(rows, 'Greatest Joys'),
    background_story: valueNearLabel(rows, 'BACKGROUND NOTES'),
    soft_spots: valueNearLabel(rows, 'Soft Spots'),
    enraged_when: valueNearLabel(rows, 'Enraged When'),
    depressed_when: valueNearLabel(rows, 'Depressed When'),
    darkest_secrets: valueNearLabel(rows, 'Darkest Secrets'),
    favourite_joke: valueNearLabel(rows, 'Favourite Joke'),
    hobbies: valueNearLabel(rows, 'Hobbies'),
  };
}

function extractContacts(rows: unknown[][]): CharacterContact[] {
  const sectionRow = rows.findIndex(row => row.some(c => str(c).toUpperCase().includes('ALLIES, CONTACTS')));
  if (sectionRow < 0) return [];
  const headerRow = rows.findIndex((row, ri) => ri > sectionRow && rowHas(row, 'Name') && rowHas(row, 'Type'));
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const nameCol = colIndex(header, 'Name');
  const genderCol = colIndex(header, 'Gender & Species');
  const typeCol = colIndex(header, 'Type');
  const descCol = colIndex(header, 'Description/Notes');
  const linkCol = colIndex(header, 'Link');
  const aliveCol = colIndex(header, 'Alive');
  const contacts: CharacterContact[] = [];

  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => str(c).toUpperCase().includes('OTHER NPC'))) break;
    const contact = {
      name: nameCol >= 0 ? clean(row[nameCol]) : null,
      gender_species: genderCol >= 0 ? clean(row[genderCol]) : null,
      type: typeCol >= 0 ? clean(row[typeCol]) : null,
      description: descCol >= 0 ? clean(row[descCol]) : null,
      link: linkCol >= 0 ? clean(row[linkCol]) : null,
      alive: aliveCol >= 0 ? bool(row[aliveCol]) : null,
    };
    if (contact.name || contact.gender_species || contact.type || contact.description || contact.link) contacts.push(contact);
  }

  return contacts;
}

// Extract weapons from CombatEquipment sheet
function extractWeapons(ws: XLSX.WorkSheet): Weapon[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const weapons: Weapon[] = [];

  let headerRow = -1;
  for (let ri = 0; ri < rows.length; ri++) {
    if (rows[ri].some(c => str(c) === 'WEAPONS')) {
      headerRow = ri + 1;
      break;
    }
  }
  if (headerRow < 0) return weapons;

  const hrow = rows[headerRow];
  const weaponCol = hrow.findIndex(c => str(c) === 'Weapon');
  const rangeCol = hrow.findIndex(c => str(c) === 'Range');
  const skillCol = hrow.findIndex(c => str(c) === 'Skill Used');
  const damageCol = hrow.findIndex(c => str(c) === 'Damage');
  const traitsCol = hrow.findIndex(c => str(c) === 'Traits');

  if (weaponCol < 0 || damageCol < 0) return weapons;

  for (let ri = headerRow + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const wname = str(row[weaponCol]);
    if (!wname) break;
    weapons.push({
      name: wname,
      skill: skillCol >= 0 ? str(row[skillCol]) : '',
      range: rangeCol >= 0 ? str(row[rangeCol]) : '',
      damage: str(row[damageCol]),
      traits: traitsCol >= 0 ? str(row[traitsCol]) : '',
    });
  }

  return weapons;
}

export function parseXLSXCharacter(buffer: ArrayBuffer, playerName?: string): CharFormBase | null {
  const wb = XLSX.read(buffer, { type: 'array' });

  // ── Profile sheet ────────────────────────────────────────────────────────────
  let characterName: string | null = null;
  let career: string | null = null;
  let rank: string | null = null;
  let homeworld: string | null = null;
  let profile_details: CharacterProfileDetails = {};
  let homeworld_details: HomeworldDetails = {};
  let lifepath: LifepathTerm[] = [];

  const profileSheet = wb.Sheets['Profile'] ?? wb.Sheets[wb.SheetNames[0]];
  if (profileSheet) {
    const profRows = rowsFrom(profileSheet);
    for (let ri = 0; ri < Math.min(profRows.length, 10); ri++) {
      const row = profRows[ri];
      for (let ci = 0; ci < row.length - 1; ci++) {
        if (str(row[ci]) === 'Name' && str(profRows[ri + 1]?.[ci])) {
          characterName = str(profRows[ri + 1][ci]);
          break;
        }
      }
      if (characterName) break;
    }
    const info = extractCareerInfo(profRows);
    career = info.career;
    rank = info.rank;
    homeworld = info.homeworld;
    profile_details = extractProfileDetails(profRows);
    homeworld_details = extractHomeworldDetails(profRows);
    lifepath = extractLifepath(profRows);
    if (!homeworld && homeworld_details.name) homeworld = homeworld_details.name;
  }

  // ── CharacteristicsSkills sheet ──────────────────────────────────────────────
  const csName = wb.SheetNames.find(n => n.toLowerCase().includes('characteristic')) ?? wb.SheetNames[1];
  const ws = wb.Sheets[csName];
  if (!ws) return null;

  const rows = rowsFrom(ws);

  // Detect column offset: 0 if "CHARACTERISTICS" starts in col A, 1 if col B (Jesse's format)
  const r0 = rows[0] ?? [];
  const offset = str(r0[0]).toUpperCase().includes('CHARACTERISTIC') ? 0 : 1;

  // Column positions (all relative to offset)
  const statLabelCol = offset;       // STR, DEX, ... labels
  const statTotalCol = offset + 1;   // Total value for each stat
  const psiLabelCol  = offset + 7;   // "PSI" label in right block
  const psiTotalCol  = offset + 11;  // PSI Total value
  const psionNameCol = offset + 7;   // Psionic skill Name column
  const psionLevelCol = offset + 12; // Psionic skill Level column (5 right of Name)

  const stats: Record<string, number | null> = {};
  const skills: Skill[] = [];
  const psionic_talents: PsionicTalent[] = [];

  // ── Pass 1: Stats ────────────────────────────────────────────────────────────
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];

    // Regular stats: label at statLabelCol, Total at statTotalCol
    const rawLabel = str(row[statLabelCol]).toUpperCase().replace(/[^A-Z]/g, '');
    if (rawLabel && STAT_ALIASES[rawLabel] !== undefined) {
      const key = STAT_ALIASES[rawLabel];
      const val = num(row[statTotalCol]);
      if (val !== null && stats[key] === undefined) stats[key] = val;
    }

    // PSI characteristic: label at psiLabelCol, Total at psiTotalCol
    const psiLabel = str(row[psiLabelCol]).toUpperCase().replace(/[^A-Z]/g, '');
    if (psiLabel === 'PSI') {
      const val = num(row[psiTotalCol]);
      if (val !== null) stats['psi'] = val;
    }

    // Eric's sheet: CHR/MOR/LCK as inline text at col 18 (e.g. "Cha: 11", "Morale: 8")
    const colR = str(row[18]);
    if (colR) {
      const chaMatch = colR.match(/cha(?:risma)?[:\s]+(\d+)/i);
      const morMatch = colR.match(/mor(?:ale)?[:\s]+(\d+)/i);
      const lukMatch = colR.match(/lu(?:c|ck|cky)?[:\s]+(\d+)/i);
      if (chaMatch && !stats['chr']) stats['chr'] = parseInt(chaMatch[1]);
      if (morMatch && !stats['mor']) stats['mor'] = parseInt(morMatch[1]);
      if (lukMatch && !stats['lck']) stats['lck'] = parseInt(lukMatch[1]);
    }
  }

  // ── Pass 2: Psionic talents ──────────────────────────────────────────────────
  // Psionic skills block is in rows 4–13 at cols psionNameCol / psionLevelCol.
  // Level "--" = not trained; skip. Level >= 0 = trained; include.
  let inPsion = false;
  for (let ri = 0; ri < Math.min(rows.length, 25); ri++) {
    const row = rows[ri];
    const cell = str(row[psionNameCol]);
    if (cell === 'PSIONIC SKILLS') { inPsion = true; continue; }
    if (!inPsion) continue;
    if (!cell || cell === 'Name') continue;
    if (!PSIONIC_NAMES.has(cell)) continue;
    const tlevel = num(row[psionLevelCol]);
    if (tlevel !== null && tlevel >= 0) {
      psionic_talents.push({ name: cell, level: tlevel });
    }
  }

  // ── Pass 3: Skills ───────────────────────────────────────────────────────────
  // Find all skill section headers: rows where "Name" appears, and "Level" is
  // within 8 columns to the right. Exclude the psionic header (Name at col ≥ 7
  // with Level exactly 5 cols right).
  interface SkillSection {
    headerRow: number;
    nameCol: number;
    specCol: number;
    levelCol: number;
  }
  const sections: SkillSection[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < row.length; ci++) {
      if (str(row[ci]).toLowerCase() !== 'name') continue;
      for (let li = ci + 1; li <= ci + 8 && li < row.length; li++) {
        if (str(row[li]).toLowerCase() !== 'level') continue;
        // Skip the psionic skills header block
        if (ci >= 7 && li - ci === 5) break;
        // Find "Specialty" column between name and level
        let specCol = ci + 1;
        for (let sc = ci + 1; sc < li; sc++) {
          if (str(row[sc]).toLowerCase().includes('spec')) { specCol = sc; break; }
        }
        sections.push({ headerRow: ri, nameCol: ci, specCol, levelCol: li });
        break;
      }
    }
  }

  // Read skills from each section; skip untrained ("--") and negative levels
  const seenSkills = new Set<string>();
  for (const sec of sections) {
    let consecutiveEmpty = 0;
    for (let ri = sec.headerRow + 1; ri < rows.length; ri++) {
      const row = rows[ri];
      const sname = str(row[sec.nameCol]);

      // Another "Name" header marks the start of a new vertical section
      if (sname.toLowerCase() === 'name') break;

      if (!sname) {
        if (++consecutiveEmpty >= 3) break;
        continue;
      }
      consecutiveEmpty = 0;

      // Skip psionic skills and section headers (all-uppercase text like "CUSTOM SKILLS")
      if (PSIONIC_NAMES.has(sname)) continue;
      if (sname === sname.toUpperCase() && sname.length > 6) continue;

      const rawLevel = row[sec.levelCol];
      if (str(rawLevel) === '--') continue;
      const level = num(rawLevel);
      if (level === null || level < 0) continue;

      const specialty = str(row[sec.specCol]);
      const fullName = specialty ? `${sname} (${specialty})` : sname;

      const key = fullName.toLowerCase();
      if (!seenSkills.has(key)) {
        seenSkills.add(key);
        skills.push({ name: fullName, level });
      }
    }
  }

  // ── Weapons ──────────────────────────────────────────────────────────────────
  const combatWs = wb.Sheets['CombatEquipment'];
  const combatRows = rowsFrom(combatWs);
  const weapons: Weapon[] = combatWs ? extractWeapons(combatWs) : [];
  if (!weapons.some(w => w.name === 'Unarmed')) weapons.push(UNARMED);
  const armour = extractArmour(combatRows);
  const augments = extractAugments(combatRows);
  const personal_equipment = extractPersonalEquipment(combatRows);
  const finances = extractFinances(combatRows);
  const background = extractBackground(rowsFrom(wb.Sheets['BackgroundPersonality']));
  const contacts = extractContacts(rowsFrom(wb.Sheets['Campaign Notes']));

  const strVal = stats['str'] ?? null;
  const dexVal = stats['dex'] ?? null;
  const endVal = stats['end_stat'] ?? null;
  const psiVal = stats['psi'] ?? null;

  return {
    name: characterName || playerName || 'Unknown',
    player: playerName ?? null,
    portrait_url: null,
    str: strVal, dex: dexVal, end_stat: endVal,
    int_stat: stats['int_stat'] ?? null,
    edu:  stats['edu']  ?? null,
    soc:  stats['soc']  ?? null,
    psi:  psiVal,
    chr:  stats['chr']  ?? null,
    mor:  stats['mor']  ?? null,
    lck:  stats['lck']  ?? null,
    str_cur: strVal, dex_cur: dexVal, end_cur: endVal, psi_cur: psiVal,
    temp_mods: {},
    profile_details,
    homeworld_details,
    lifepath,
    armour,
    augments,
    personal_equipment,
    finances,
    contacts,
    background,
    career,
    rank,
    homeworld,
    skills,
    psionic_talents,
    weapons,
    notes: null,
  };
}
