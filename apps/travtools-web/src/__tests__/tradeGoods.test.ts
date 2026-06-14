import { describe, it, expect } from 'vitest';
import { TRADE_GOODS, searchTradeGoods, formatBasePrice } from '../data/tradeGoods';

describe('TRADE_GOODS table', () => {
  it('has exactly 36 entries (D66 11–66)', () => {
    expect(TRADE_GOODS).toHaveLength(36);
  });

  it('has unique d66 codes', () => {
    const codes = TRADE_GOODS.map(g => g.d66);
    expect(new Set(codes).size).toBe(36);
  });

  it('first entry is D66 11 Common Electronics', () => {
    expect(TRADE_GOODS[0].d66).toBe(11);
    expect(TRADE_GOODS[0].type).toBe('Common Electronics');
  });

  it('last entry is D66 66 Exotics', () => {
    const last = TRADE_GOODS[TRADE_GOODS.length - 1];
    expect(last.d66).toBe(66);
    expect(last.exotic).toBe(true);
    expect(last.basePrice).toBeNull();
  });

  it('illegal goods (61–65) are flagged', () => {
    const illegal = TRADE_GOODS.filter(g => g.illegal);
    expect(illegal).toHaveLength(5);
    illegal.forEach(g => {
      expect(g.d66).toBeGreaterThanOrEqual(61);
      expect(g.d66).toBeLessThanOrEqual(65);
    });
  });

  it('all non-exotic entries have a basePrice', () => {
    TRADE_GOODS.filter(g => !g.exotic).forEach(g => {
      expect(g.basePrice).not.toBeNull();
    });
  });

  it('Radioactives (45) has basePrice MCr1', () => {
    const radio = TRADE_GOODS.find(g => g.d66 === 45);
    expect(radio?.basePrice).toBe(1_000_000);
  });
});

describe('searchTradeGoods', () => {
  it('returns all 36 for an empty query', () => {
    expect(searchTradeGoods('')).toHaveLength(36);
    expect(searchTradeGoods('  ')).toHaveLength(36);
  });

  it('filters by type name (case-insensitive)', () => {
    const results = searchTradeGoods('cybernetics');
    expect(results.length).toBeGreaterThanOrEqual(2);
    results.forEach(g => expect(g.type.toLowerCase()).toContain('cybernetics'));
  });

  it('filters by trade code (availability)', () => {
    const results = searchTradeGoods('asteroid');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(g => expect(g.availability.toLowerCase()).toContain('asteroid'));
  });

  it('filters by abbreviated trade code', () => {
    const results = searchTradeGoods('Ht');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(g => [g.availability, g.purchaseDM, g.saleDM].some(value => value.includes('High Tech')))).toBe(true);
  });

  it('filters by d66 code as string', () => {
    const results = searchTradeGoods('45');
    expect(results.some(g => g.d66 === 45)).toBe(true);
  });

  it('returns empty array for unmatched query', () => {
    expect(searchTradeGoods('zzznomatch')).toHaveLength(0);
  });
});

describe('formatBasePrice', () => {
  it('formats null as em-dash', () => {
    expect(formatBasePrice(null)).toBe('—');
  });

  it('formats millions as MCr', () => {
    expect(formatBasePrice(1_000_000)).toBe('MCr1');
  });

  it('formats thousands as Cr…k', () => {
    expect(formatBasePrice(20_000)).toBe('Cr20k');
  });

  it('formats sub-thousand as Cr…', () => {
    expect(formatBasePrice(500)).toBe('Cr500');
  });
});
