import { describe, expect, it } from 'vitest';
import { rollAnalytics } from '../lib/rollAnalytics';
import type { RollLogEntry } from '../types';

function entry(id: string, effect: number, success: boolean): RollLogEntry {
  return {
    id,
    character_name: 'Session',
    check_label: id,
    d1: 3,
    d2: 4,
    char_dm: 0,
    skill_level: 0,
    bonus_dm: 0,
    total: 7 + effect,
    difficulty: 7,
    success,
    effect,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('rollAnalytics', () => {
  it('returns empty analytics for no entries', () => {
    expect(rollAnalytics([])).toEqual({
      total: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageEffect: 0,
      best: null,
      worst: null,
    });
  });

  it('summarises success rate, average effect, and extremes', () => {
    const rolls = [entry('bad', -4, false), entry('ok', 0, true), entry('great', 5, true)];
    const analytics = rollAnalytics(rolls);

    expect(analytics.total).toBe(3);
    expect(analytics.successCount).toBe(2);
    expect(analytics.failureCount).toBe(1);
    expect(analytics.successRate).toBe(67);
    expect(analytics.averageEffect).toBeCloseTo(1 / 3);
    expect(analytics.best?.id).toBe('great');
    expect(analytics.worst?.id).toBe('bad');
  });
});
