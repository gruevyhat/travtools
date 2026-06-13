import { rollD66 } from './dice';
import {
  ALLIES_ENEMIES,
  CHARACTER_QUIRKS,
  EXPERIENCE_LEVELS,
  ExperienceLevel,
  lookupD66,
} from '../data/quickCharacters';
import { Skill } from '../types';

export interface GeneratedNPC {
  archetype: string;
  quirk: string;
  experienceLevel: ExperienceLevel;
  str: number;
  dex: number;
  end_stat: number;
  int_stat: number;
  edu: number;
  soc: number;
  skills: Skill[];
  career: string;
  notes: string;
}

function roll2D6(roller: () => number): number {
  return Math.floor(roller() * 6) + 1 + Math.floor(roller() * 6) + 1;
}

export function generateCharacteristics(roller?: () => number): number[] {
  const r = roller ?? Math.random;
  return [roll2D6(r), roll2D6(r), roll2D6(r), roll2D6(r), roll2D6(r), roll2D6(r)];
}

// Add bonuses (sorted descending) to the highest N characteristics.
export function applyExperienceBonuses(stats: number[], bonuses: number[]): number[] {
  if (bonuses.length === 0) return [...stats];
  const result = [...stats];
  const sortedBonuses = [...bonuses].sort((a, b) => b - a);
  const indices = result
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map(x => x.i);
  sortedBonuses.forEach((bonus, n) => {
    if (n < indices.length) result[indices[n]] += bonus;
  });
  return result;
}

export function randomExperienceLevel(roller?: () => number): ExperienceLevel {
  const r = roller ?? Math.random;
  return EXPERIENCE_LEVELS[Math.floor(r() * EXPERIENCE_LEVELS.length)];
}

export function generateQuickCharacter(opts?: { roller?: () => number }): GeneratedNPC {
  const roller = opts?.roller ?? Math.random;

  const { d66: archetypeD66 } = rollD66(roller);
  const { d66: quirkD66 } = rollD66(roller);

  const archetypeEntry = lookupD66(ALLIES_ENEMIES, archetypeD66) ?? ALLIES_ENEMIES[0];
  const quirkEntry = lookupD66(CHARACTER_QUIRKS, quirkD66) ?? CHARACTER_QUIRKS[0];
  const experienceLevel = randomExperienceLevel(roller);

  const raw = generateCharacteristics(roller);
  const [str, dex, end_stat, int_stat, edu, soc] = applyExperienceBonuses(raw, experienceLevel.charBonuses);

  return {
    archetype: archetypeEntry.archetype,
    quirk: quirkEntry.quirk,
    experienceLevel,
    str, dex, end_stat, int_stat, edu, soc,
    skills: experienceLevel.skills,
    career: archetypeEntry.archetype,
    notes: quirkEntry.quirk,
  };
}
