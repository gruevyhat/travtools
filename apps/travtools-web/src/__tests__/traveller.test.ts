import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  toHex, upp, statDM, skillChar, parseSkillsCSV, parseTalentsCSV, parseCSV,
} from '../lib/traveller';
import { parseXLSXCharacter } from '../lib/parseXLSX';
import type { Character } from '../types';

const baseChar: Character = {
  id: '1', name: 'Test', created_at: '',
  portrait_url: null,
  str: 9, dex: 11, end_stat: 11, int_stat: 8, edu: 10, soc: 4, psi: null,
  chr: null, mor: null, lck: null,
  str_cur: null, dex_cur: null, end_cur: null, psi_cur: null,
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
  player: null, career: null, rank: null, homeworld: null,
  skills: [], psionic_talents: [], weapons: [], notes: null,
};

describe('toHex', () => {
  it('returns null as ?', () => expect(toHex(null)).toBe('?'));
  it('returns undefined as ?', () => expect(toHex(undefined)).toBe('?'));
  it('renders 0–9 as digits', () => {
    expect(toHex(0)).toBe('0');
    expect(toHex(9)).toBe('9');
  });
  it('renders 10+ as uppercase letters', () => {
    expect(toHex(10)).toBe('A');
    expect(toHex(11)).toBe('B');
    expect(toHex(15)).toBe('F');
  });
});

describe('upp', () => {
  it('formats core stats as hex string when expanded stats are absent', () => {
    // str=9 dex=11(B) end=11(B) int=8 edu=10(A) soc=4
    expect(upp(baseChar)).toBe('9BB8A4');
  });
  it('includes PSI and extra attributes in expanded UPP', () => {
    const c: Character = { ...baseChar, psi: 12, chr: 7, mor: 8, lck: 9 };
    expect(upp(c)).toBe('9BB8A4-C789');
  });
  it('omits missing expanded attributes instead of rendering ?', () => {
    const c: Character = { ...baseChar, chr: 7, mor: 8, lck: 9 };
    expect(upp(c)).toBe('9BB8A4-789');
  });
  it('omits PSI 0 from expanded UPP', () => {
    const c: Character = { ...baseChar, psi: 0, chr: 7, mor: 8, lck: 9 };
    expect(upp(c)).toBe('9BB8A4-789');
  });
  it('null stats render as ?', () => {
    const c: Character = { ...baseChar, str: null, edu: null };
    // dex=11(B) end=11(B) int=8 soc=4
    expect(upp(c)).toBe('?BB8?4');
  });
});

describe('statDM', () => {
  it('null → -3', () => expect(statDM(null)).toBe(-3));
  it('0 → -3', () => expect(statDM(0)).toBe(-3));
  it('1 → -2', () => expect(statDM(1)).toBe(-2));
  it('2 → -2', () => expect(statDM(2)).toBe(-2));
  it('3 → -1', () => expect(statDM(3)).toBe(-1));
  it('5 → -1', () => expect(statDM(5)).toBe(-1));
  it('6 → 0', () => expect(statDM(6)).toBe(0));
  it('8 → 0', () => expect(statDM(8)).toBe(0));
  it('9 → +1', () => expect(statDM(9)).toBe(1));
  it('11 → +1', () => expect(statDM(11)).toBe(1));
  it('12 → +2', () => expect(statDM(12)).toBe(2));
  it('14 → +2', () => expect(statDM(14)).toBe(2));
  it('15 → +3', () => expect(statDM(15)).toBe(3));
});

describe('skillChar', () => {
  it('returns governing char for exact match', () => {
    expect(skillChar('Admin')).toBe('edu');
    expect(skillChar('Gun Combat (Slug)')).toBe('dex');
    expect(skillChar('Medic')).toBe('edu');
    expect(skillChar('Recon')).toBe('int_stat');
    expect(skillChar('Melee (Blade)')).toBe('dex');
  });
  it('falls back to parent skill', () => {
    expect(skillChar('Language (Darrian)')).toBe('int_stat');
    expect(skillChar('Science (Xenobiology)')).toBe('edu');
    expect(skillChar('Drive (Hovercraft)')).toBe('dex');
  });
  it('returns null for unknown skill', () => {
    expect(skillChar('Jack-of-All-Trades')).toBeNull();
    expect(skillChar('NonExistentSkill')).toBeNull();
  });
});

describe('parseSkillsCSV', () => {
  it('parses skill-level pairs', () => {
    expect(parseSkillsCSV('Pilot-2,Navigation-1')).toEqual([
      { name: 'Pilot', level: 2 },
      { name: 'Navigation', level: 1 },
    ]);
  });
  it('handles skills with spaces and parentheses', () => {
    expect(parseSkillsCSV('Gun Combat (Slug)-3')).toEqual([
      { name: 'Gun Combat (Slug)', level: 3 },
    ]);
  });
  it('defaults to level 0 for skills without level', () => {
    expect(parseSkillsCSV('Admin')).toEqual([{ name: 'Admin', level: 0 }]);
  });
  it('handles level 0 skills', () => {
    expect(parseSkillsCSV('Recon-0')).toEqual([{ name: 'Recon', level: 0 }]);
  });
  it('trims whitespace', () => {
    expect(parseSkillsCSV(' Pilot-2 , Navigation-1 ')).toEqual([
      { name: 'Pilot', level: 2 },
      { name: 'Navigation', level: 1 },
    ]);
  });
  it('ignores empty entries', () => {
    expect(parseSkillsCSV('')).toEqual([]);
    expect(parseSkillsCSV('  ,  ')).toEqual([]);
  });
});

describe('parseTalentsCSV', () => {
  it('parses psionic talents', () => {
    expect(parseTalentsCSV('Awareness-1,Telepathy-0')).toEqual([
      { name: 'Awareness', level: 1 },
      { name: 'Telepathy', level: 0 },
    ]);
  });
  it('returns empty array for empty string', () => {
    expect(parseTalentsCSV('')).toEqual([]);
  });
});

describe('parseCSV', () => {
  it('parses a full row', () => {
    const csv =
      'Name,STR,DEX,END,INT,EDU,SOC,PSI,Career,Rank,Homeworld,Skills,PsionicTalents,Notes\n' +
      'Zlata,6,7,8,12,12,11,0,Scholar,Researcher,Darrian,Medic-2,,"Some notes"';
    const [c] = parseCSV(csv);
    expect(c.name).toBe('Zlata');
    expect(c.str).toBe(6);
    expect(c.int_stat).toBe(12);
    expect(c.psi).toBe(0);
    expect(c.skills).toEqual([{ name: 'Medic', level: 2 }]);
    expect(c.psionic_talents).toEqual([]);
    expect(c.notes).toBe('Some notes');
  });

  it('parses psionic talents column', () => {
    const csv =
      'Name,STR,DEX,END,INT,EDU,SOC,PSI,Skills,PsionicTalents\n' +
      'Graham,9,11,11,8,10,4,0,"Gun Combat (Slug)-3","Awareness-1,Telepathy-0"';
    const [c] = parseCSV(csv);
    expect(c.psionic_talents).toEqual([
      { name: 'Awareness', level: 1 },
      { name: 'Telepathy', level: 0 },
    ]);
  });

  it('parses portrait URL column aliases', () => {
    const csv = 'Name,Portrait URL\nTester,https://example.com/portrait.png';
    const [c] = parseCSV(csv);
    expect(c.portrait_url).toBe('https://example.com/portrait.png');
  });

  it('handles missing optional columns', () => {
    const csv = 'Name,STR,DEX,END,INT,EDU,SOC\nTest,9,9,9,9,9,9';
    const [c] = parseCSV(csv);
    expect(c.name).toBe('Test');
    expect(c.psi).toBeNull();
    expect(c.career).toBeNull();
    expect(c.rank).toBe('Traveller');
    expect(c.skills).toEqual([]);
    expect(c.psionic_talents).toEqual([]);
  });

  it('handles quoted fields with internal commas', () => {
    const csv = 'Name,Skills\nTester,"Pilot-2,Navigation-1"';
    const [c] = parseCSV(csv);
    expect(c.skills).toHaveLength(2);
  });

  it('skips empty lines', () => {
    const csv = 'Name,STR\nAlice,9\n\n\nBob,8';
    expect(parseCSV(csv)).toHaveLength(2);
  });

  it('returns empty array for header-only input', () => {
    expect(parseCSV('Name,STR,DEX')).toEqual([]);
  });
});

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('parseXLSXCharacter profile title', () => {
  it('uses a text title from term notes instead of a numeric rank code', () => {
    const buffer = workbookBuffer({
      Profile: [
        ['', '', 'Name'],
        ['', '', 'Rafael Navarro'],
        [],
        ['', '', 'Term', 'Career', 'Assignment', 'Surv.?', 'Com.?', 'Adv.?', 'Rank', 'Events, Connections, & Notes'],
        ['', '', 1, 'Army', 'Infantry', true, false, true, 1, '-1 PSI; Lance Corp.; Adv Training.'],
      ],
      CharacteristicsSkills: [
        ['CHARACTERISTICS'],
        ['STR', 9],
        ['DEX', 11],
        ['END', 11],
        ['INT', 8],
        ['EDU', 10],
        ['SOC', 4],
      ],
    });

    const parsed = parseXLSXCharacter(buffer, 'Graham');

    expect(parsed.career).toBe('Army');
    expect(parsed.rank).toBe('Lance Corp');
    expect(parsed.lifepath[0].rank).toBe('1');
  });

  it('defaults the title to Traveller when no text title is present', () => {
    const buffer = workbookBuffer({
      Profile: [
        ['', '', 'Name'],
        ['', '', 'Jesse'],
      ],
      CharacteristicsSkills: [
        ['CHARACTERISTICS'],
        ['STR', 4],
        ['DEX', 6],
        ['END', 8],
        ['INT', 10],
        ['EDU', 11],
        ['SOC', 9],
      ],
    });

    const parsed = parseXLSXCharacter(buffer, 'Jesse');

    expect(parsed.rank).toBe('Traveller');
  });
});

describe('parseXLSXCharacter combat equipment', () => {
  it('does not import Subdermal Armour Protection as armour', () => {
    const buffer = workbookBuffer({
      CharacteristicsSkills: [
        ['CHARACTERISTICS'],
        ['STR', 7],
        ['DEX', 8],
        ['END', 9],
        ['INT', 10],
        ['EDU', 11],
        ['SOC', 6],
      ],
      CombatEquipment: [
        ['Worn', 'Armour Type', 'Protection', 'Rad', 'Required Skill'],
        [true, 'Subdermal Armour Protection', 0, 0, null],
        [true, 'Jack', 1, 0, null],
        ['AUGMENTS'],
      ],
    });

    const parsed = parseXLSXCharacter(buffer, 'Tester');

    expect(parsed.armour).toEqual([
      expect.objectContaining({ name: 'Jack', protection: 1 }),
    ]);
  });
});

describe('parseXLSXCharacter background/personality', () => {
  it('imports populated BackgroundPersonality fields and relationship contacts', () => {
    const buffer = workbookBuffer({
      CharacteristicsSkills: [
        ['CHARACTERISTICS'],
        ['STR', 7],
        ['DEX', 8],
        ['END', 9],
        ['INT', 10],
        ['EDU', 11],
        ['SOC', 6],
      ],
      BackgroundPersonality: [
        ['PERSONALITY', '', '', '', '', '', '', '', '', 'APPEARANCE', '', '', '', '', '', 'BACKGROUND'],
        ['DESCRIPTOR OPPOSITES', '', '', '', '', '', '', '', '', 'Basic Desc.', 'weathered scout', '', '', '', '', 'From Profile'],
        ['Diplomatic', '', false, false, true, false, false, 'Violent'],
        ['Visual Age', '42', '', '', '', '', '', '', '', 'Body Build', 'lean'],
        ['GENERAL DESCRIPTION'],
        ['', 'Rugged square face and mirror shades.'],
        ['', 'Slow drawl with dry one-liners.'],
        ['Conversation & Speech Quirks'],
        ['Greatest Fears', 'Being captured again.'],
        ['Most at Ease', 'In a dimly lit spacer bar.'],
        ['The Lie You Believe', 'I am better off alone.'],
        ['Mentor', 'Captain Voss', '', 'Alive', true],
        ['Relationship', 'Saved him from the Order.'],
      ],
    });

    const parsed = parseXLSXCharacter(buffer, 'Rafael');

    expect(parsed.background.personality_descriptors).toContain('Diplomatic / Violent: 3 of 5');
    expect(parsed.background.basic_description).toBe('weathered scout');
    expect(parsed.background.body_build).toBe('lean');
    expect(parsed.background.general_description).toBe('Rugged square face and mirror shades.');
    expect(parsed.background.speech_quirks).toBe('Slow drawl with dry one-liners.');
    expect(parsed.background.greatest_fears).toBe('Being captured again.');
    expect(parsed.background.most_at_ease).toBe('In a dimly lit spacer bar.');
    expect(parsed.background.lie_you_believe).toBe('I am better off alone.');
    expect(parsed.contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Captain Voss',
        type: 'Mentor',
        description: 'Saved him from the Order.',
        alive: true,
      }),
    ]));
  });
});

describe('parseXLSXCharacter error handling', () => {
  it('throws with a useful message when the characteristics sheet is missing', () => {
    // XLSX.read can parse many buffers without throwing; the error surfaces
    // when the expected "CharacteristicsSkills" sheet is not found.
    const garbage = new TextEncoder().encode('this is not an xlsx file').buffer;
    expect(() => parseXLSXCharacter(garbage as ArrayBuffer)).toThrow(
      /CharacteristicsSkills/,
    );
  });

  it('error message names the sheets that were found', () => {
    const garbage = new TextEncoder().encode('plain text').buffer;
    try {
      parseXLSXCharacter(garbage as ArrayBuffer);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      // Message must contain either the sheet name hint or the file-read hint
      expect((err as Error).message).toMatch(/CharacteristicsSkills|valid \.xlsx/i);
    }
  });
});
