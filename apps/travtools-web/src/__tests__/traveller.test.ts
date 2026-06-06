import { describe, it, expect } from 'vitest';
import {
  toHex, upp, statDM, skillChar, parseSkillsCSV, parseTalentsCSV, parseCSV,
} from '../lib/traveller';
import type { Character } from '../types';

const baseChar: Character = {
  id: '1', name: 'Test', created_at: '',
  str: 9, dex: 11, end_stat: 11, int_stat: 8, edu: 10, soc: 4, psi: null,
  career: null, rank: null, homeworld: null, skills: [], psionic_talents: [], notes: null,
};

describe('toHex', () => {
  it('returns null as ?', () => expect(toHex(null)).toBe('?'));
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
  it('formats 6 stats as hex string', () => {
    // str=9 dex=11(B) end=11(B) int=8 edu=10(A) soc=4
    expect(upp(baseChar)).toBe('9BB8A4');
  });
  it('PSI is not included in UPP string', () => {
    const c: Character = { ...baseChar, psi: 12 };
    expect(upp(c)).toHaveLength(6);
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

  it('handles missing optional columns', () => {
    const csv = 'Name,STR,DEX,END,INT,EDU,SOC\nTest,9,9,9,9,9,9';
    const [c] = parseCSV(csv);
    expect(c.name).toBe('Test');
    expect(c.psi).toBeNull();
    expect(c.career).toBeNull();
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
