import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import TradeLedger from '../components/trade/TradeLedger';
import {
  applyPurchaseDMs,
  calculateLotCost,
  calculateProfit,
  dealsToCsv,
  filterTradeDeals,
  freightTraffic,
  formatTradeCodeList,
  formatTradeDmString,
  formatCr,
  passengerTraffic,
  parseWorldUwp,
  profit,
  splitPassengerIncome,
  tradeSummary,
  type WorldProfile,
} from '../lib/trade';
import { lookupModifiedPrice } from '../data/modifiedPrice';
import { lookupFreightTraffic } from '../data/freightTraffic';
import { lookupPassengerTraffic } from '../data/passengerTraffic';
import type { Character, TradeDeal } from '../types';
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

const neutralWorld: WorldProfile = {
  name: 'Neutral',
  tradeCodes: [],
  starport: 'D',
  population: 5,
  techLevel: 8,
  lawLevel: 5,
  zone: 'normal',
};

const baseCharacter: Character = {
  id: 'char-1',
  name: 'Mara Vale',
  player: null,
  portrait_url: null,
  str: 7,
  dex: 8,
  end_stat: 8,
  int_stat: 10,
  edu: 9,
  soc: 11,
  psi: null,
  chr: null,
  mor: null,
  lck: null,
  str_cur: null,
  dex_cur: null,
  end_cur: null,
  psi_cur: null,
  temp_mods: {},
  profile_details: {},
  homeworld_details: {},
  lifepath: [],
  armour: [],
  augments: [],
  personal_equipment: [],
  finances: {},
  contacts: [],
  background: {},
  career: 'Merchant',
  rank: 'Broker',
  homeworld: 'Regina',
  skills: [
    { name: 'Broker', level: 2 },
    { name: 'Streetwise', level: 1 },
    { name: 'Steward', level: 1 },
    { name: 'Carouse', level: 1 },
  ],
  psionic_talents: [],
  weapons: [],
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
};

const brokerSpecialist: Character = {
  ...baseCharacter,
  id: 'char-2',
  name: 'Talia Quon',
  int_stat: 7,
  skills: [
    { name: 'Broker', level: 4 },
    { name: 'Streetwise', level: 0 },
    { name: 'Steward', level: 0 },
  ],
};

function makeTradeClient(initialDeals: TradeDeal[] = [], initialCharacters: Character[] = []) {
  let deals = [...initialDeals];
  const characters = [...initialCharacters];
  const orderDeals = vi.fn(async () => ({ data: deals, error: null }));
  const orderCharacters = vi.fn(async () => ({ data: characters, error: null }));
  const selectDeals = vi.fn(() => ({ order: orderDeals }));
  const selectCharacters = vi.fn(() => ({ order: orderCharacters }));
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
      from: vi.fn((table: string) => (
        table === 'characters'
          ? { select: selectCharacters, insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
          : { select: selectDeals, insert, update, delete: deleteFn }
      )),
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

  it('uses the corrected modified price table', () => {
    expect(lookupModifiedPrice(-3)).toEqual({ roll: -3, purchasePct: 300, salePct: 10 });
    expect(lookupModifiedPrice(10)).toEqual({ roll: 10, purchasePct: 90, salePct: 90 });
    expect(lookupModifiedPrice(25)).toEqual({ roll: 25, purchasePct: 15, salePct: 400 });
  });

  it('applies purchase DMs and clamps to the modified price range', () => {
    const result = applyPurchaseDMs(10, 2, 4, 1, 2);
    expect(result.rawRoll).toBe(13);
    expect(result.clampedRoll).toBe(13);
    expect(result.row.purchasePct).toBe(75);

    const clamped = applyPurchaseDMs(3, -5, -5, 8, 4);
    expect(clamped.rawRoll).toBe(-19);
    expect(clamped.clampedRoll).toBe(-3);
    expect(clamped.row.purchasePct).toBe(300);
  });

  it('calculates lot cost and speculative profit', () => {
    expect(calculateLotCost(20_000, 75, 4)).toBe(60_000);
    expect(calculateProfit(20_000, 75, 110, 4)).toBe(28_000);
  });

  it('formats trade classifications as Traveller trade codes', () => {
    expect(formatTradeCodeList('Industrial, High Tech, Rich')).toBe('In, Ht, Ri');
    expect(formatTradeDmString('Industrial+2, High Tech+3, Non-Industrial−2')).toBe('In+2, Ht+3, Ni-2');
  });

  it('parses UWP strings into trade world profile values', () => {
    expect(parseWorldUwp('a788899-c')).toEqual({
      normalized: 'A788899-C',
      starport: 'A',
      size: 7,
      atmosphere: 8,
      hydrographics: 8,
      population: 8,
      government: 9,
      lawLevel: 9,
      techLevel: 12,
    });
    expect(parseWorldUwp('Q788899-C')).toBeNull();
    expect(parseWorldUwp('A78889-C')).toBeNull();
  });

  it('looks up passenger and freight traffic dice', () => {
    expect(lookupPassengerTraffic(7).passengerDice).toBe(3);
    expect(lookupPassengerTraffic(0).passengerDice).toBe(0);
    expect(lookupPassengerTraffic(21).passengerDice).toBe(10);

    expect(lookupFreightTraffic(8).lotDice).toBe(3);
    expect(lookupFreightTraffic(1).lotDice).toBe(0);
    expect(lookupFreightTraffic(20).lotDice).toBe(10);
  });

  it('calculates passenger and freight income from traffic results', () => {
    const passengers = passengerTraffic({
      roll: 7,
      passengerClass: 'middle',
      parsecs: 1,
      source: neutralWorld,
      destination: neutralWorld,
    }, [4, 3, 2]);
    expect(passengers.dice).toBe(3);
    expect(passengers.passengers).toBe(9);
    expect(passengers.income).toBe(58_500);

    const freight = freightTraffic({
      roll: 8,
      lotSize: 'minor',
      parsecs: 2,
      source: neutralWorld,
      destination: neutralWorld,
    }, [3, 2, 1]);
    expect(freight.dice).toBe(3);
    expect(freight.lots).toBe(6);
    expect(freight.tons).toBe(30);
    expect(freight.income).toBe(48_000);
  });

  it('sums passenger income by class and parsec distance', () => {
    expect(splitPassengerIncome({ high: 1, middle: 2, basic: 3, low: 4 }, 1)).toBe(30_800);
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

  it('renders the M11 trade session and passenger/freight tabs', async () => {
    const mock = makeTradeClient([], [baseCharacter]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<TradeLedger />);

    fireEvent.click(screen.getByRole('button', { name: 'TRADE SESSION' }));
    expect(await screen.findByText(/TRADE SESSION · ROUTE/i)).toBeTruthy();
    expect(screen.getByLabelText('Source UWP')).toBeTruthy();
    expect(screen.queryByLabelText('Source Starport')).toBeNull();
    expect(screen.queryByLabelText('Source Population')).toBeNull();
    fireEvent.change(screen.getByLabelText('Source UWP'), { target: { value: 'C100200-8' } });
    expect((screen.getByLabelText('Source UWP') as HTMLInputElement).value).toBe('C100200-8');
    expect(screen.getByRole('button', { name: /2 SUPPLIER/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /3 LOTS/i }));
    expect(screen.getByRole('button', { name: /ROLL LOTS/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'PASSENGERS & FREIGHT' }));
    expect(await screen.findByText('PASSAGE AND FREIGHT CONTROL')).toBeTruthy();
    expect(screen.getByLabelText('Passenger Traffic Check Character')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ROLL PASSENGERS/i })).toBeTruthy();
  });

  it('creates an active ledger deal from a priced trade-session cart', async () => {
    const mock = makeTradeClient([], [baseCharacter]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(<TradeLedger />);

    fireEvent.click(screen.getByRole('button', { name: 'TRADE SESSION' }));
    fireEvent.click(await screen.findByRole('button', { name: /3 LOTS/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ROLL LOTS/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /CART/i }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'PRICE' }));
    fireEvent.click(screen.getByRole('button', { name: /PURCHASE ALL/i }));

    await waitFor(() => {
      expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active',
        world_bought: 'Regina',
        session_ref: 'Session Trade Run',
        base_price: expect.any(Number),
        purchase_pct: expect.any(Number),
      }));
    });
  });

  it('preselects the best roster character for the selected trade check while allowing override', async () => {
    const mock = makeTradeClient([], [baseCharacter, brokerSpecialist]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(<TradeLedger />);

    fireEvent.click(screen.getByRole('button', { name: 'TRADE SESSION' }));
    fireEvent.click(await screen.findByRole('button', { name: /2 SUPPLIER/i }));

    const characterSelect = await screen.findByLabelText('Supplier Check Character') as HTMLSelectElement;
    expect(characterSelect.value).toBe('char-2');

    fireEvent.change(screen.getByLabelText('Supplier Check Skill'), { target: { value: 'Streetwise' } });
    await waitFor(() => {
      expect(characterSelect.value).toBe('char-1');
    });

    fireEvent.change(characterSelect, { target: { value: 'char-2' } });
    expect(characterSelect.value).toBe('char-2');
    fireEvent.click(screen.getByRole('button', { name: /ROLL SUPPLIER/i }));

    expect(await screen.findByText(/Talia Quon · Streetwise\/INT/i)).toBeTruthy();
  });

  it('lets roster characters roll trade and traffic checks', async () => {
    const mock = makeTradeClient([], [baseCharacter]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    render(<TradeLedger />);

    fireEvent.click(screen.getByRole('button', { name: 'TRADE SESSION' }));
    fireEvent.click(await screen.findByRole('button', { name: /2 SUPPLIER/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ROLL SUPPLIER/i }));

    expect(await screen.findByText(/Mara Vale · Broker\/INT/i)).toBeTruthy();
    expect(screen.getByText(/EFFECT/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'PASSENGERS & FREIGHT' }));
    fireEvent.click((await screen.findAllByRole('button', { name: /ROLL CHECK/i }))[0]);

    await waitFor(() => {
      expect((screen.getByLabelText('Passenger Effect') as HTMLInputElement).value).toBe('3');
    });
  });
});
