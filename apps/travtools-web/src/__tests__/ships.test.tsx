import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ShipViewer from '../components/ships/ShipViewer';
import { CANONICAL_SHIPS } from '../components/ships/canonicalShips';
import { annotationPosition, removeAnnotationById } from '../lib/ships';
import type { Ship } from '../types';
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
