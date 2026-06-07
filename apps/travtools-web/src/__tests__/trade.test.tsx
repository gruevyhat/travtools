import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import TradeLedger from '../components/trade/TradeLedger';
import {
  dealsToCsv,
  filterTradeDeals,
  formatCr,
  profit,
  tradeSummary,
} from '../lib/trade';
import type { TradeDeal } from '../types';
import * as SupabaseContext from '../lib/supabaseContext';

const baseDeals: TradeDeal[] = [
  {
    id: 'deal-1',
    item: 'Advanced Electronics',
    quantity: 2,
    buy_price: 1000,
    sell_price: null,
    status: 'active',
    world_bought: 'Regina',
    world_sold: null,
    notes: null,
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  },
  {
    id: 'deal-2',
    item: 'Luxury Goods',
    quantity: 3,
    buy_price: 120.5,
    sell_price: 140.75,
    status: 'completed',
    world_bought: 'Mora',
    world_sold: 'Regina',
    notes: 'Brokered quickly',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'deal-3',
    item: 'Cancelled Lot',
    quantity: 0,
    buy_price: 999,
    sell_price: 2000,
    status: 'cancelled',
    world_bought: 'Efate',
    world_sold: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

function makeTradeClient(initialDeals: TradeDeal[] = []) {
  let deals = [...initialDeals];
  const order = vi.fn(async () => ({ data: deals, error: null }));
  const select = vi.fn(() => ({ order }));
  const insert = vi.fn((payload: Omit<TradeDeal, 'id' | 'created_at' | 'updated_at'>) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => {
        const row = {
          id: 'deal-new',
          created_at: '2026-01-04T00:00:00Z',
          updated_at: '2026-01-04T00:00:00Z',
          ...payload,
        } as TradeDeal;
        deals = [...deals, row];
        return { data: row, error: null };
      }),
    })),
  }));
  const update = vi.fn((payload: Partial<TradeDeal>) => ({
    eq: vi.fn((_: string, id: string) => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          const existing = deals.find(deal => deal.id === id) ?? deals[0];
          const row = { ...existing, ...payload } as TradeDeal;
          deals = deals.map(deal => deal.id === id ? row : deal);
          return { data: row, error: null };
        }),
      })),
    })),
  }));
  const deleteFn = vi.fn(() => ({
    eq: vi.fn(async (_: string, id: string) => {
      deals = deals.filter(deal => deal.id !== id);
      return { error: null };
    }),
  }));

  return {
    client: {
      from: vi.fn(() => ({ select, insert, update, delete: deleteFn })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
    insert,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trade helpers', () => {
  it('calculates profit for positive, negative, null, fractional, and zero-quantity deals', () => {
    expect(profit({ buy_price: 10, sell_price: 15, quantity: 4 })).toBe(20);
    expect(profit({ buy_price: 15, sell_price: 10, quantity: 4 })).toBe(-20);
    expect(profit({ buy_price: null, sell_price: 10, quantity: 4 })).toBeNull();
    expect(profit({ buy_price: 120.5, sell_price: 140.75, quantity: 3 })).toBeCloseTo(60.75);
    expect(profit({ buy_price: 10, sell_price: 100, quantity: 0 })).toBe(0);
  });

  it('formats credits', () => {
    expect(formatCr(null)).toBe('--');
    expect(formatCr(0)).toBe('Cr 0');
    expect(formatCr(1234567)).toBe('Cr 1,234,567');
    expect(formatCr(10.25)).toBe('Cr 10.25');
  });

  it('filters by status and world', () => {
    expect(filterTradeDeals(baseDeals, { status: 'active' }).map(deal => deal.item)).toEqual(['Advanced Electronics']);
    expect(filterTradeDeals(baseDeals, { world: 'reg' }).map(deal => deal.item)).toEqual(['Advanced Electronics', 'Luxury Goods']);
    expect(filterTradeDeals(baseDeals, { status: 'completed', world: 'mora' }).map(deal => deal.item)).toEqual(['Luxury Goods']);
  });

  it('summarises active capital and completed profit', () => {
    expect(tradeSummary(baseDeals)).toEqual({
      activeCapital: 2000,
      realisedProfit: 60.75,
      totalDeals: 3,
    });
  });

  it('exports deals as csv with quoted cells', () => {
    const csv = dealsToCsv([{ ...baseDeals[1], item: 'Luxury, Goods' }]);
    expect(csv).toContain('"Luxury, Goods",3,120.5,140.75,60.75,Mora,Regina,completed,Brokered quickly');
  });
});

describe('TradeLedger', () => {
  it('renders loaded deals and summary values', async () => {
    const mock = makeTradeClient(baseDeals);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<TradeLedger />);

    expect(await screen.findByText('Advanced Electronics')).toBeTruthy();
    expect(screen.getAllByText('Cr 2,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Cr 60.75')).toBeTruthy();
  });

  it('submits a new deal form', async () => {
    const mock = makeTradeClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<TradeLedger />);

    fireEvent.click(screen.getByRole('button', { name: /NEW DEAL/i }));
    fireEvent.change(screen.getByLabelText('Item / Cargo'), { target: { value: 'Advanced Electronics' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    await waitFor(() => {
      expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ item: 'Advanced Electronics' }));
    });
    expect(await screen.findByText('Advanced Electronics')).toBeTruthy();
  });
});
