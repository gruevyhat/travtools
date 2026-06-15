import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import InventoryManager from '../components/inventory/InventoryManager';
import {
  categoryChipClass,
  filterInventoryItems,
  inventoryItemsFromCharacters,
  inventoryTotals,
  PARTY_OWNER_LABEL,
  type InventoryCharacter,
} from '../lib/inventory';
import type { InventoryItem } from '../types';
import * as SupabaseContext from '../lib/supabaseContext';

const baseItems: InventoryItem[] = [
  {
    id: 'item-1',
    name: 'Laser Rifle',
    category: 'Weapon',
    quantity: 2,
    weight_kg: 4,
    value_cr: 2500,
    owner: 'Ari',
    location: 'Ship Locker',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'item-2',
    name: 'Medkit',
    category: 'Medicine',
    quantity: 1,
    weight_kg: null,
    value_cr: 500,
    owner: 'Bea',
    location: 'Sickbay',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'item-3',
    name: 'Empty Crate',
    category: 'Cargo',
    quantity: 0,
    weight_kg: 10,
    value_cr: null,
    owner: 'Ari',
    location: 'Cargo Bay',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const rosterCharacters: InventoryCharacter[] = [
  {
    id: 'char-1',
    name: 'Ariadne Quinn',
    player: 'Graham',
    created_at: '2026-01-01T00:00:00Z',
    weapons: [
      { name: 'Unarmed', skill: 'Melee (Unarmed)', range: 'Melee', damage: '1D+STR DM', traits: '' },
      { name: 'Laser Pistol', skill: 'Gun Combat (Energy)', range: '20m', damage: '3D+3', traits: 'Zero-G', quantity: 1, mass: 1, cost: 2000 },
    ],
    armour: [
      { worn: true, name: 'Cloth (TL10)', protection: 8, radiation: null, required_skill: null, quantity: 1, mass: 3, cost: 500 },
    ],
    personal_equipment: [
      { quantity: 2, name: 'Data Wafer', notes: 'Market intel', tech_level: 10, mass: null, cost: 5 },
    ],
    augments: [
      { name: 'Wafer Jack (Bandwidth/4)', notes: 'Trade sims', tech_level: 12, cost: 10000 },
    ],
  },
];

function makeInventoryClient(initialItems: InventoryItem[] = [], initialCharacters: InventoryCharacter[] = []) {
  let items = [...initialItems];
  const characters = [...initialCharacters];
  const order = vi.fn(async () => ({ data: items, error: null }));
  const select = vi.fn(() => ({ order }));
  const characterOrder = vi.fn(async () => ({ data: characters, error: null }));
  const characterSelect = vi.fn(() => ({ order: characterOrder }));
  const single = vi.fn(async () => ({ data: null, error: null }));
  const insert = vi.fn((payload: Omit<InventoryItem, 'id' | 'created_at'>) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => {
        const row = { id: 'item-new', created_at: '2026-01-02T00:00:00Z', ...payload } as InventoryItem;
        items = [...items, row];
        return { data: row, error: null };
      }),
    })),
  }));
  const update = vi.fn((payload: Partial<InventoryItem>) => ({
    eq: vi.fn((_: string, id: string) => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          const existing = items.find(item => item.id === id) ?? items[0];
          const row = { ...existing, ...payload } as InventoryItem;
          items = items.map(item => item.id === id ? row : item);
          return { data: row, error: null };
        }),
      })),
    })),
  }));
  const deleteFn = vi.fn(() => ({
    eq: vi.fn(async (_: string, id: string) => {
      items = items.filter(item => item.id !== id);
      return { error: null };
    }),
    in: vi.fn(async (_: string, ids: string[]) => {
      items = items.filter(item => !ids.includes(item.id));
      return { error: null };
    }),
  }));

  return {
    client: {
      from: vi.fn((table: string) => table === 'characters'
        ? { select: characterSelect }
        : { select, insert, update, delete: deleteFn }),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
    insert,
    select,
    characterSelect,
    single,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('inventory helpers', () => {
  it('calculates totals with quantity and excludes null weights/values', () => {
    expect(inventoryTotals(baseItems)).toEqual({
      totalWeight: 8,
      totalValue: 5500,
    });
  });

  it('filters by owner, category, and both combined', () => {
    expect(filterInventoryItems(baseItems, { owner: 'Ari' }).map(item => item.name)).toEqual(['Laser Rifle', 'Empty Crate']);
    expect(filterInventoryItems(baseItems, { category: 'Medicine' }).map(item => item.name)).toEqual(['Medkit']);
    expect(filterInventoryItems(baseItems, { owner: 'Ari', category: 'Cargo' }).map(item => item.name)).toEqual(['Empty Crate']);
    expect(filterInventoryItems(baseItems, {})).toHaveLength(3);
  });

  it('returns distinct category chip classes', () => {
    expect(categoryChipClass('Weapon')).toContain('text-alert');
    expect(categoryChipClass('Medicine')).toContain('text-safe');
    expect(categoryChipClass('Cargo')).toContain('text-amber');
  });

  it('projects roster equipment, armour, augments, and weapons into inventory rows', () => {
    const rows = inventoryItemsFromCharacters(rosterCharacters);

    expect(rows.map(item => item.name)).toEqual(expect.arrayContaining([
      'Laser Pistol',
      'Cloth (TL10)',
      'Data Wafer',
      'Wafer Jack (Bandwidth/4)',
    ]));
    expect(rows.some(item => item.name === 'Unarmed')).toBe(false);
    expect(rows.find(item => item.name === 'Laser Pistol')).toMatchObject({
      category: 'Weapon',
      owner: 'Ariadne Quinn',
      source: 'roster',
      readOnly: true,
    });
  });
});

describe('InventoryManager', () => {
  it('renders loaded inventory items', async () => {
    const mock = makeInventoryClient(baseItems, rosterCharacters);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<InventoryManager />);

    expect(await screen.findByText('Laser Rifle')).toBeTruthy();
    expect(screen.getByText('Medkit')).toBeTruthy();
    expect(screen.getByText('Laser Pistol')).toBeTruthy();
    expect(screen.getByText('Roster weapon')).toBeTruthy();
  });

  it('submits the add item form', async () => {
    const mock = makeInventoryClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<InventoryManager />);

    fireEvent.click(screen.getByRole('button', { name: /ADD ITEM/i }));
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Advanced Medkit' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    await waitFor(() => {
      expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Advanced Medkit', owner: PARTY_OWNER_LABEL }));
    });
    expect(await screen.findByText('Advanced Medkit')).toBeTruthy();
    expect(screen.queryByText('EQUIPMENT REFERENCE - CORE RULES')).toBeNull();
  });

  it('submits an item owned by a roster character', async () => {
    const mock = makeInventoryClient([], rosterCharacters);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<InventoryManager />);

    expect(await screen.findByText('Laser Pistol')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ADD ITEM/i }));
    fireEvent.change(screen.getByLabelText('Item Name'), { target: { value: 'Spare Battery' } });
    fireEvent.change(screen.getByLabelText('Owner Type'), { target: { value: 'character' } });
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'char-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    await waitFor(() => {
      expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spare Battery', owner: 'Ariadne Quinn' }));
    });
  });

  it('populates the add item form from the Core Rules equipment reference', async () => {
    const mock = makeInventoryClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<InventoryManager />);

    await waitFor(() => expect(mock.select).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /ADD ITEM/i }));
    fireEvent.click(screen.getByText('Medikit (TL10)').closest('button') as HTMLElement);

    expect((screen.getByLabelText('Item Name') as HTMLInputElement).value).toBe('Medikit (TL10)');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('Medicine');
    expect((screen.getByLabelText('Weight (kg each)') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('Value (Cr each)') as HTMLInputElement).value).toBe('1500');
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toContain('Core Rules p.114');
  });
});
