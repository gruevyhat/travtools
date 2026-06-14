import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import ShipViewer from '../components/ships/ShipViewer';
import ShipBuilder from '../components/ships/ShipBuilder';
import { CANONICAL_SHIPS } from '../components/ships/canonicalShips';
import { computeShipSummary, defaultDesign } from '../lib/shipBuilder';
import { annotationPosition, removeAnnotationById } from '../lib/ships';
import type { Ship, ShipDesign } from '../types';
import * as SupabaseContext from '../lib/supabaseContext';

const scoutShip: Ship = {
  id: 'ship-1',
  name: 'Scout/Courier',
  ship_class: 'Type-S',
  tonnage: 100,
  image_url: null,
  schematic_type: 'canonical',
  canonical_id: 'type-s',
  annotations: [],
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
};

function makeShipClient(ships: Ship[] = [scoutShip]) {
  const order = vi.fn(async () => ({ data: ships, error: null }));
  const select = vi.fn(() => ({ order }));

  return {
    from: vi.fn(() => ({ select })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
}

function makeShipBuilderClient(designs: ShipDesign[], shipInsertError: string | null = null) {
  const order = vi.fn(async () => ({ data: designs, error: null }));
  const select = vi.fn(() => ({ order }));
  const insertShip = vi.fn(async () => ({
    data: null,
    error: shipInsertError ? { message: shipInsertError } : null,
  }));
  const unsubscribe = vi.fn();
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => ({ unsubscribe })),
  };

  return {
    insertShip,
    client: {
      from: vi.fn((table: string) => {
        if (table === 'ship_designs') {
          return {
            select,
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
            delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          };
        }
        if (table === 'ships') {
          return { insert: insertShip };
        }
        return {};
      }),
      channel: vi.fn(() => channel),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ship helpers', () => {
  it('calculates annotation position as a percentage of the schematic rect', () => {
    expect(annotationPosition(150, 90, { left: 50, top: 40, width: 200, height: 100 })).toEqual({ x: 50, y: 50 });
  });

  it('clamps annotation positions to schematic bounds', () => {
    expect(annotationPosition(500, -20, { left: 50, top: 40, width: 200, height: 100 })).toEqual({ x: 100, y: 0 });
  });

  it('removes annotations by id', () => {
    const annotations = [
      { id: 'a', x: 10, y: 20, label: 'A' },
      { id: 'b', x: 30, y: 40, label: 'B' },
    ];
    expect(removeAnnotationById(annotations, 'a')).toEqual([{ id: 'b', x: 30, y: 40, label: 'B' }]);
  });
});

describe('canonical ships', () => {
  it('defines required canonical ship metadata', () => {
    expect(CANONICAL_SHIPS.length).toBeGreaterThanOrEqual(3);
    for (const ship of CANONICAL_SHIPS) {
      expect(ship.id).toBeTruthy();
      expect(ship.name).toBeTruthy();
      expect(ship.ship_class).toBeTruthy();
      expect(ship.tonnage).toBeGreaterThan(0);
      expect(ship.Component).toBeTypeOf('function');
    }
  });
});

describe('ShipViewer', () => {
  it('renders the ship list and a canonical SVG', async () => {
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: makeShipClient() as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<ShipViewer />);

    expect((await screen.findAllByText('Scout/Courier')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Type-S Scout/Courier deck plan')).toBeTruthy();
  });
});

describe('ShipBuilder', () => {
  it('updates running totals when a design input changes', async () => {
    const { client } = makeShipBuilderClient([]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<ShipBuilder />);

    fireEvent.click(screen.getByRole('button', { name: 'NEW DESIGN' }));
    await waitFor(() => expect(container.textContent).toContain('TONS 36t/100t CARGO 64t'));

    fireEvent.click(screen.getByRole('button', { name: '200t' }));
    await waitFor(() => expect(container.textContent).toContain('TONS 47t/200t CARGO 153t'));
  });

  it('surfaces ADD TO FLEET failures without showing a false success state', async () => {
    const designState = { ...defaultDesign(), name: 'Overbuilt Barge', staterooms: 100 };
    const design: ShipDesign = {
      id: 'design-1',
      name: designState.name,
      design: designState,
      summary: computeShipSummary(designState),
      diagram_url: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const { client, insertShip } = makeShipBuilderClient([design], 'permission denied');
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<ShipBuilder />);

    fireEvent.click(await screen.findByText('Overbuilt Barge'));
    fireEvent.click(await screen.findByRole('button', { name: 'ADD TO FLEET' }));

    await waitFor(() => expect(insertShip).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Ship could not be added to the Fleet: permission denied/)).toBeTruthy();
    expect(screen.queryByText('IN FLEET')).toBeNull();
  });
});
