export type RollMode = 'normal' | 'boon' | 'bane';

export interface TravellerRollInput {
  label: string;
  difficulty: number;
  modifier: number;
  mode: RollMode;
  roller?: () => number;
}

export interface TravellerRollResult {
  label: string;
  mode: RollMode;
  rolls: number[];
  kept: number[];
  discarded: number | null;
  modifier: number;
  diceTotal: number;
  total: number;
  difficulty: number;
  success: boolean;
  effect: number;
}

export const DIFFICULTIES = [
  { label: 'Routine', target: 6 },
  { label: 'Average', target: 8 },
  { label: 'Difficult', target: 10 },
  { label: 'Very Difficult', target: 12 },
  { label: 'Formidable', target: 14 },
];

function d6(roller: () => number): number {
  return Math.floor(roller() * 6) + 1;
}

export function rollTravellerCheck(input: TravellerRollInput): TravellerRollResult {
  const roller = input.roller ?? Math.random;
  const rolls = Array.from({ length: input.mode === 'normal' ? 2 : 3 }, () => d6(roller));
  const sorted = [...rolls].sort((a, b) => a - b);
  const kept = input.mode === 'boon'
    ? sorted.slice(1)
    : input.mode === 'bane'
      ? sorted.slice(0, 2)
      : rolls;
  const discarded = input.mode === 'normal'
    ? null
    : input.mode === 'boon'
      ? sorted[0]
      : sorted[2];
  const diceTotal = kept.reduce((sum, roll) => sum + roll, 0);
  const total = diceTotal + input.modifier;

  return {
    label: input.label.trim() || 'Standalone',
    mode: input.mode,
    rolls,
    kept,
    discarded,
    modifier: input.modifier,
    diceTotal,
    total,
    difficulty: input.difficulty,
    success: total >= input.difficulty,
    effect: total - input.difficulty,
  };
}

export function fmtDM(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export interface FluxRollResult {
  die1: number;
  die2: number;
  result: number; // die1 - die2, range -5 to +5
}

export function rollFlux(roller?: () => number): FluxRollResult {
  const r = roller ?? Math.random;
  const die1 = d6(r);
  const die2 = d6(r);
  return { die1, die2, result: die1 - die2 };
}
