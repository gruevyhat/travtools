import { RollLogEntry } from '../types';

export interface RollAnalytics {
  total: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageEffect: number;
  best: RollLogEntry | null;
  worst: RollLogEntry | null;
}

export function rollAnalytics(entries: RollLogEntry[]): RollAnalytics {
  if (entries.length === 0) {
    return {
      total: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageEffect: 0,
      best: null,
      worst: null,
    };
  }

  const successCount = entries.filter(entry => entry.success).length;
  const effectTotal = entries.reduce((sum, entry) => sum + entry.effect, 0);

  return {
    total: entries.length,
    successCount,
    failureCount: entries.length - successCount,
    successRate: Math.round((successCount / entries.length) * 100),
    averageEffect: effectTotal / entries.length,
    best: entries.reduce((best, entry) => entry.effect > best.effect ? entry : best, entries[0]),
    worst: entries.reduce((worst, entry) => entry.effect < worst.effect ? entry : worst, entries[0]),
  };
}
