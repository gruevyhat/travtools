import { describe, it, expect } from 'vitest';
import {
  generateCharacteristics,
  applyExperienceBonuses,
  randomExperienceLevel,
  generateQuickCharacter,
} from '../lib/quickCharGen';
import { ALLIES_ENEMIES, CHARACTER_QUIRKS, lookupD66 } from '../data/quickCharacters';
import { randomRace, randomName, RACES } from '../data/npcNames';

// Deterministic roller: cycles through provided sequence
function seqRoller(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateCharacteristics', () => {
  it('returns 6 values', () => {
    expect(generateCharacteristics()).toHaveLength(6);
  });

  it('all values in [2, 12]', () => {
    for (let n = 0; n < 50; n++) {
      const stats = generateCharacteristics();
      stats.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(2);
        expect(s).toBeLessThanOrEqual(12);
      });
    }
  });

  it('uses injected roller', () => {
    // roller returns 0.5 → floor(0.5*6)+1 = 4; each die is 4, each 2D6 = 8
    const stats = generateCharacteristics(seqRoller([0.5]));
    expect(stats).toEqual([8, 8, 8, 8, 8, 8]);
  });
});

describe('applyExperienceBonuses', () => {
  it('no bonuses returns same stats', () => {
    const stats = [7, 8, 5, 6, 9, 4];
    expect(applyExperienceBonuses(stats, [])).toEqual([7, 8, 5, 6, 9, 4]);
  });

  it('applies bonuses to the highest stats (desc)', () => {
    // stats: [7,8,5,6,9,4] → sorted by value desc: idx4=9, idx1=8, idx0=7, idx3=6, idx2=5, idx5=4
    // bonuses [2,1] sorted desc: 2→idx4, 1→idx1
    const result = applyExperienceBonuses([7, 8, 5, 6, 9, 4], [2, 1]);
    expect(result[4]).toBe(11); // 9+2
    expect(result[1]).toBe(9);  // 8+1
    expect(result[0]).toBe(7);  // unchanged
  });

  it('does not mutate original stats array', () => {
    const stats = [7, 8, 5, 6, 9, 4];
    applyExperienceBonuses(stats, [1, 2]);
    expect(stats).toEqual([7, 8, 5, 6, 9, 4]);
  });
});

describe('randomExperienceLevel', () => {
  it('returns a valid experience level', () => {
    const level = randomExperienceLevel();
    expect(level).toHaveProperty('id');
    expect(level).toHaveProperty('label');
    expect(level).toHaveProperty('skills');
    expect(Array.isArray(level.skills)).toBe(true);
  });
});

describe('generateQuickCharacter', () => {
  it('returns all required fields including name and race', () => {
    const npc = generateQuickCharacter();
    expect(typeof npc.name).toBe('string');
    expect(npc.name.length).toBeGreaterThan(0);
    expect(typeof npc.race).toBe('string');
    expect(typeof npc.archetype).toBe('string');
    expect(typeof npc.quirk).toBe('string');
    expect(npc.experienceLevel).toBeDefined();
    expect(npc.skills).toEqual(npc.experienceLevel.skills);
    expect(typeof npc.str).toBe('number');
    expect(typeof npc.dex).toBe('number');
    expect(typeof npc.end_stat).toBe('number');
    expect(typeof npc.int_stat).toBe('number');
    expect(typeof npc.edu).toBe('number');
    expect(typeof npc.soc).toBe('number');
  });

  it('career matches archetype, notes matches quirk', () => {
    const npc = generateQuickCharacter();
    expect(npc.career).toBe(npc.archetype);
    expect(npc.notes).toBe(npc.quirk);
  });

  it('characteristics are in plausible range (2–18 after bonuses)', () => {
    for (let n = 0; n < 20; n++) {
      const npc = generateQuickCharacter();
      [npc.str, npc.dex, npc.end_stat, npc.int_stat, npc.edu, npc.soc].forEach(stat => {
        expect(stat).toBeGreaterThanOrEqual(2);
        expect(stat).toBeLessThanOrEqual(18);
      });
    }
  });
});

describe('randomRace and randomName', () => {
  it('randomRace returns a known race label', () => {
    const labels = RACES.map(r => r.label);
    for (let n = 0; n < 20; n++) {
      expect(labels).toContain(randomRace());
    }
  });

  it('Human probability is ~90% over many rolls', () => {
    let humans = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (randomRace() === 'Human') humans++;
    }
    // Allow ±5% tolerance
    expect(humans / N).toBeGreaterThan(0.85);
    expect(humans / N).toBeLessThan(0.95);
  });

  it('randomName returns a non-empty string for every race', () => {
    for (const { label } of RACES) {
      const name = randomName(label);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('randomName uses injectable roller', () => {
    // deterministic roller → deterministic name
    const r = () => 0;
    const name1 = randomName('Human', r);
    const name2 = randomName('Human', r);
    expect(name1).toBe(name2);
    expect(typeof name1).toBe('string');
  });
});

describe('D66 table coverage', () => {
  it('ALLIES_ENEMIES has 36 entries', () => {
    expect(ALLIES_ENEMIES).toHaveLength(36);
  });

  it('ALLIES_ENEMIES covers all valid D66 values', () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const d66 = d1 * 10 + d2;
        const entry = lookupD66(ALLIES_ENEMIES, d66);
        expect(entry, `D66=${d66} missing`).toBeDefined();
      }
    }
  });

  it('CHARACTER_QUIRKS has 36 entries', () => {
    expect(CHARACTER_QUIRKS).toHaveLength(36);
  });

  it('CHARACTER_QUIRKS covers all valid D66 values', () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const d66 = d1 * 10 + d2;
        const entry = lookupD66(CHARACTER_QUIRKS, d66);
        expect(entry, `D66=${d66} missing`).toBeDefined();
      }
    }
  });
});
