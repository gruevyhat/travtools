import { describe, expect, it } from 'vitest';
import type { PartyTreasuryTransaction } from '../types';
import {
  filterTreasuryTransactions,
  formatTreasuryCr,
  normalizeTransactionAmount,
  runningBalance,
  runningBalancesById,
  splitLoot,
} from '../lib/treasury';

const transactions: PartyTreasuryTransaction[] = [
  {
    id: 't1',
    created_at: '2026-01-01T00:00:00Z',
    amount: 10000,
    type: 'loot',
    description: 'Recovered cargo',
    character_id: null,
    session_ref: 'Session 3',
  },
  {
    id: 't2',
    created_at: '2026-01-02T00:00:00Z',
    amount: -2500,
    type: 'share',
    description: 'Ariadne share',
    character_id: 'char-1',
    session_ref: 'Session 3',
  },
  {
    id: 't3',
    created_at: '2026-01-03T00:00:00Z',
    amount: -500,
    type: 'expense',
    description: 'Dock fees',
    character_id: null,
    session_ref: 'Session 4',
  },
];

describe('treasury helpers', () => {
  it('sums positive and negative transactions into a running balance', () => {
    expect(runningBalance(transactions)).toBe(7000);
  });

  it('splits loot into integer shares and leaves the remainder in party funds', () => {
    expect(splitLoot(10001, 4)).toEqual({
      total: 10001,
      participantCount: 4,
      perShare: 2500,
      remainder: 1,
    });
  });

  it('handles a zero-participant split without dividing by zero', () => {
    expect(splitLoot(750, 0)).toEqual({
      total: 750,
      participantCount: 0,
      perShare: 0,
      remainder: 750,
    });
  });

  it('filters by type and session reference', () => {
    expect(filterTreasuryTransactions(transactions, { type: 'share' }).map(row => row.id)).toEqual(['t2']);
    expect(filterTreasuryTransactions(transactions, { sessionRef: 'session 4' }).map(row => row.id)).toEqual(['t3']);
    expect(filterTreasuryTransactions(transactions, { type: 'expense', sessionRef: 'session 3' })).toEqual([]);
  });

  it('builds chronological running balances for newest-first displays', () => {
    const balances = runningBalancesById(transactions);
    expect(balances.get('t1')).toBe(10000);
    expect(balances.get('t2')).toBe(7500);
    expect(balances.get('t3')).toBe(7000);
  });

  it('formats credits and normalizes form amounts by transaction type', () => {
    expect(formatTreasuryCr(123456)).toBe('Cr 123,456');
    expect(formatTreasuryCr(-2500)).toBe('-Cr 2,500');
    expect(normalizeTransactionAmount(500.4, 'income')).toBe(500);
    expect(normalizeTransactionAmount(500.6, 'expense')).toBe(-501);
    expect(normalizeTransactionAmount(2500, 'share')).toBe(-2500);
  });
});
