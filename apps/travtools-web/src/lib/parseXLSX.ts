import * as XLSX from 'xlsx';
import { CharFormBase } from './traveller';
import { PsionicTalent, Skill, Weapon } from '../types';

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

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
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

  const profileSheet = wb.Sheets['Profile'] ?? wb.Sheets[wb.SheetNames[0]];
  if (profileSheet) {
    const profRows: unknown[][] = XLSX.utils.sheet_to_json(profileSheet, { header: 1, defval: '' });
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
  }

  // ── CharacteristicsSkills sheet ──────────────────────────────────────────────
  const csName = wb.SheetNames.find(n => n.toLowerCase().includes('characteristic')) ?? wb.SheetNames[1];
  const ws = wb.Sheets[csName];
  if (!ws) return null;

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

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
  const weapons: Weapon[] = combatWs ? extractWeapons(combatWs) : [];
  if (!weapons.some(w => w.name === 'Unarmed')) weapons.push(UNARMED);

  const strVal = stats['str'] ?? null;
  const dexVal = stats['dex'] ?? null;
  const endVal = stats['end_stat'] ?? null;
  const psiVal = stats['psi'] ?? null;

  return {
    name: characterName || playerName || 'Unknown',
    player: playerName ?? null,
    str: strVal, dex: dexVal, end_stat: endVal,
    int_stat: stats['int_stat'] ?? null,
    edu:  stats['edu']  ?? null,
    soc:  stats['soc']  ?? null,
    psi:  psiVal,
    chr:  stats['chr']  ?? null,
    mor:  stats['mor']  ?? null,
    lck:  stats['lck']  ?? null,
    str_cur: strVal, dex_cur: dexVal, end_cur: endVal, psi_cur: psiVal,
    career,
    rank,
    homeworld,
    skills,
    psionic_talents,
    weapons,
    notes: null,
  };
}
