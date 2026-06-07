import { describe, expect, it } from 'vitest';
import { fmtDM, rollTravellerCheck } from '../lib/dice';

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
