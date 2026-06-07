import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import InventoryManager from '../components/inventory/InventoryManager';
import {
  categoryChipClass,
  filterInventoryItems,
  inventoryTotals,
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

function makeInventoryClient(initialItems: InventoryItem[] = []) {
  let items = [...initialItems];
  const order = vi.fn(async () => ({ data: items, error: null }));
  const select = vi.fn(() => ({ order }));
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
      from: vi.fn(() => ({ select, insert, update, delete: deleteFn })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
    insert,
    select,
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
});

describe('InventoryManager', () => {
  it('renders loaded inventory items', async () => {
    const mock = makeInventoryClient(baseItems);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<InventoryManager />);

    expect(await screen.findByText('Laser Rifle')).toBeTruthy();
    expect(screen.getByText('Medkit')).toBeTruthy();
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
      expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Advanced Medkit' }));
    });
    expect(await screen.findByText('Advanced Medkit')).toBeTruthy();
  });
});
