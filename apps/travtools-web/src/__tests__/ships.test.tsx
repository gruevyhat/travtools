import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import ShipViewer from '../components/ships/ShipViewer';
import ShipBuilder from '../components/ships/ShipBuilder';
import { CANONICAL_SHIPS } from '../components/ships/canonicalShips';
import { computeShipSummary, defaultDesign } from '../lib/shipBuilder';
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
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  return {
    update,
    updateEq,
    from: vi.fn(() => ({ select, update })),
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
  it('sorts fleet ships by name through the viewer load path', async () => {
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: makeShipClient([
        { ...scoutShip, id: 'ship-b', name: 'Zulu' },
        { ...scoutShip, id: 'ship-a', name: 'Alpha' },
      ]) as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<ShipViewer />);
    await screen.findAllByText('Alpha');
    const sidebarText = within(container.querySelector('aside') as HTMLElement).getAllByRole('button').map(button => button.textContent ?? '').join(' ');
    expect(sidebarText.indexOf('Alpha')).toBeLessThan(sidebarText.indexOf('Zulu'));
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

  it('moves edit to the selected ship header and removes schematic labels', async () => {
    const shipWithAnnotation: Ship = {
      ...scoutShip,
      annotations: [{ id: 'ann-1', x: 50, y: 50, label: 'Bridge Watch' }],
    };
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: makeShipClient([shipWithAnnotation]) as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<ShipViewer />);

    await screen.findByLabelText('Type-S Scout/Courier deck plan');
    const sidebar = within(container.querySelector('aside') as HTMLElement);
    expect(sidebar.queryByRole('button', { name: 'Edit Scout/Courier ship' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'LABEL' })).toBeNull();
    expect(screen.queryByLabelText('Annotation Bridge Watch')).toBeNull();
    expect(screen.getAllByText('SCHEMATIC').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Scout/Courier ship' }));
    expect(await screen.findByRole('textbox', { name: 'Ship name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'SAVE' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeTruthy();
  });

  it('labels systems manifest values', async () => {
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: makeShipClient() as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<ShipViewer />);

    await screen.findByLabelText('Type-S Scout/Courier deck plan');
    expect(screen.getByText('JUMP')).toBeTruthy();
    expect(screen.getByText('THRUST')).toBeTruthy();
    expect(screen.getByText('HULL HP')).toBeTruthy();
  });

  it('starts editing from locked system and software add buttons and saves specs', async () => {
    const client = makeShipClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<ShipViewer />);

    await screen.findByLabelText('Type-S Scout/Courier deck plan');
    fireEvent.click(screen.getByRole('button', { name: 'ADD SYSTEM' }));
    await screen.findByLabelText('System name 1');
    fireEvent.change(screen.getByLabelText('System name 1'), { target: { value: 'Fuel Processors' } });
    fireEvent.change(screen.getByLabelText('System quantity 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'ADD SOFTWARE' }));
    fireEvent.change(await screen.findByLabelText('Software name 1'), { target: { value: 'Fire Control' } });
    fireEvent.change(screen.getByLabelText('Software rating 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    await waitFor(() => expect(client.update).toHaveBeenLastCalledWith(expect.objectContaining({
      specs: expect.objectContaining({
        systems: [expect.objectContaining({ name: 'Fuel Processors', quantity: 2 })],
        software: [expect.objectContaining({ name: 'Fire Control', rating: 2 })],
      }),
    })));
  });

  it('cancels local ship record edits without persisting', async () => {
    const client = makeShipClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<ShipViewer />);

    await screen.findByLabelText('Type-S Scout/Courier deck plan');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Scout/Courier ship' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Ship name' }), { target: { value: 'Unsaved Scout' } });
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));

    expect(client.update).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Ship name' })).toBeNull());
    expect(screen.queryByText('Unsaved Scout')).toBeNull();
  });

  it('shows ammo before damage and persists ammo edits', async () => {
    const client = makeShipClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    const { container } = render(<ShipViewer />);

    await screen.findByLabelText('Type-S Scout/Courier deck plan');
    const text = container.textContent ?? '';
    expect(text.indexOf('AMMUNITION')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('DAMAGE TRACKERS')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('AMMUNITION')).toBeLessThan(text.indexOf('DAMAGE TRACKERS'));

    fireEvent.click(screen.getByRole('button', { name: 'ADD AMMO' }));

    await waitFor(() => expect(client.update).toHaveBeenLastCalledWith({
      ammo: [expect.objectContaining({ name: 'Missiles', current: 12, max: 12 })],
    }));

    fireEvent.change(await screen.findByLabelText('Ammo current 1'), { target: { value: '9' } });

    await waitFor(() => expect(client.update).toHaveBeenLastCalledWith({
      ammo: [expect.objectContaining({ name: 'Missiles', current: 9, max: 12 })],
    }));
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
