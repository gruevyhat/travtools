import { describe, expect, it } from 'vitest';
import { fmtDM, rollFlux, rollTravellerCheck } from '../lib/dice';

function roller(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('dice helpers', () => {
  it('rolls a normal 2D check with modifier and effect', () => {
    const result = rollTravellerCheck({
      label: 'Pilot',
      difficulty: 8,
      modifier: 2,
      mode: 'normal',
      roller: roller([0, 0.99]),
    });

    expect(result.rolls).toEqual([1, 6]);
    expect(result.kept).toEqual([1, 6]);
    expect(result.total).toBe(9);
    expect(result.success).toBe(true);
    expect(result.effect).toBe(1);
  });

  it('uses the best two dice for boon', () => {
    const result = rollTravellerCheck({
      label: 'Broker',
      difficulty: 10,
      modifier: 0,
      mode: 'boon',
      roller: roller([0, 0.5, 0.99]),
    });

    expect(result.rolls).toEqual([1, 4, 6]);
    expect(result.kept).toEqual([4, 6]);
    expect(result.discarded).toBe(1);
    expect(result.total).toBe(10);
  });

  it('uses the worst two dice for bane', () => {
    const result = rollTravellerCheck({
      label: 'Stealth',
      difficulty: 8,
      modifier: -1,
      mode: 'bane',
      roller: roller([0, 0.5, 0.99]),
    });

    expect(result.kept).toEqual([1, 4]);
    expect(result.discarded).toBe(6);
    expect(result.total).toBe(4);
    expect(result.success).toBe(false);
  });

  it('formats DMs', () => {
    expect(fmtDM(2)).toBe('+2');
    expect(fmtDM(0)).toBe('+0');
    expect(fmtDM(-3)).toBe('-3');
  });
});

describe('rollFlux', () => {
  function seqRoller(values: number[]) {
    let i = 0;
    return () => values[i++ % values.length] ?? 0;
  }

  it('returns die1 - die2 as the result', () => {
    // roller returns 0.5 → d6 = floor(0.5*6)+1 = 4
    //                  0.0 → d6 = floor(0.0*6)+1 = 1
    const r = rollFlux(seqRoller([0.5, 0.0]));
    expect(r.die1).toBe(4);
    expect(r.die2).toBe(1);
    expect(r.result).toBe(3);
  });

  it('can produce zero when both dice are equal', () => {
    const r = rollFlux(seqRoller([0.5, 0.5]));
    expect(r.result).toBe(0);
  });

  it('can produce negative result when die2 > die1', () => {
    // 0.0 → 1, 0.99 → 6
    const r = rollFlux(seqRoller([0.0, 0.99]));
    expect(r.die1).toBe(1);
    expect(r.die2).toBe(6);
    expect(r.result).toBe(-5);
  });

  it('result is bounded to [-5, +5]', () => {
    const maxPos = rollFlux(seqRoller([0.99, 0.0]));
    const maxNeg = rollFlux(seqRoller([0.0, 0.99]));
    expect(maxPos.result).toBe(5);
    expect(maxNeg.result).toBe(-5);
  });
});
