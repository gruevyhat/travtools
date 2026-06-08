import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import CombatTracker from '../components/combat/CombatTracker';
import * as SupabaseContext from '../lib/supabaseContext';
import type { Character } from '../types';

function makeCombatClient(characters: Partial<Character>[] = []) {
  const order = vi.fn(async () => ({ data: characters, error: null }));
  const select = vi.fn(() => ({ order }));
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const channels: Array<{ on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }> = [];
  const channel = vi.fn(() => {
    const ch = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      send: vi.fn(async () => ({})),
    };
    channels.push(ch);
    return ch;
  });

  return {
    client: {
      from: vi.fn(() => ({ select, update })),
      channel,
      removeChannel: vi.fn(),
    },
    channel,
    channels,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CombatTracker', () => {
  it('adds an NPC to the selected side', async () => {
    const mock = makeCombatClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);
    await screen.findByText('No combatants yet.');

    const allyButton = screen.getByRole('button', { name: 'ALLY' });
    const enemyButton = screen.getByRole('button', { name: 'ENEMY' });
    expect(enemyButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(allyButton);
    expect(allyButton).toHaveAttribute('aria-pressed', 'true');
    expect(enemyButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.change(screen.getByPlaceholderText(/Pirate/), { target: { value: 'Marine' } });
    fireEvent.change(screen.getByPlaceholderText('auto'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'ADD NPC' }));

    expect(within(screen.getByLabelText('Allied combatants')).getByText('Marine')).toBeTruthy();
    expect(within(screen.getByLabelText('Adversary combatants')).queryByText('Marine')).toBeNull();
  });

  it('lets NPC hit tracking be enabled after adding an NPC', async () => {
    const mock = makeCombatClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);
    await screen.findByText('No combatants yet.');

    fireEvent.change(screen.getByPlaceholderText(/Pirate/), { target: { value: 'Corsair' } });
    fireEvent.change(screen.getByPlaceholderText('auto'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'ADD NPC' }));

    fireEvent.click(within(screen.getByLabelText('Corsair combatant card')).getByRole('button', { name: /DETAILS/i }));
    expect(screen.getByText(/No hits tracked/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Corsair max hits'), { target: { value: '12' } });
    expect(screen.getByText('12/12')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('damage'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'DAMAGE' }));

    expect(screen.getByText('7/12')).toBeTruthy();
  });

  it('adds core NPC archetypes with skills, weapons, and armor-aware damage', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    let now = 1;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);
    const mock = makeCombatClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);
    await screen.findByText('No combatants yet.');

    fireEvent.change(screen.getByLabelText('Core NPC Archetype'), { target: { value: 'security-patrol' } });
    fireEvent.click(screen.getByRole('button', { name: /ADD ARCHETYPE/i }));
    fireEvent.click(screen.getByRole('button', { name: 'ALLY' }));
    fireEvent.change(screen.getByLabelText('Core NPC Archetype'), { target: { value: 'thug' } });
    fireEvent.click(screen.getByRole('button', { name: /ADD ARCHETYPE/i }));

    expect(within(screen.getByLabelText('Adversary combatants')).getByText('Security Patrol')).toBeTruthy();
    expect(within(screen.getByLabelText('Allied combatants')).getByText('Thug')).toBeTruthy();

    const securityCard = screen.getByLabelText('Security Patrol combatant card');
    const thugCard = screen.getByLabelText('Thug combatant card');
    fireEvent.click(within(securityCard).getByRole('button', { name: /DETAILS/i }));

    expect(within(securityCard).getByText(/Gun \(Slug\)-1/)).toBeTruthy();
    expect(within(securityCard).getByText(/Autopistol 3D-3/)).toBeTruthy();
    expect(within(securityCard).getByText(/Armor 5/)).toBeTruthy();

    const targetOption = within(securityCard).getByRole('option', { name: 'Thug (Ally)' }) as HTMLOptionElement;
    fireEvent.change(within(securityCard).getByLabelText(/Target/i), { target: { value: targetOption.value } });
    fireEvent.click(within(securityCard).getByRole('button', { name: /Autopistol 3D-3/i }));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Security Patrol -> Thug');
      expect(document.body.textContent).toContain('armor 1');
      expect(document.body.textContent).toContain('5 applied');
      expect(within(thugCard).getByText('Hits 9/14')).toBeTruthy();
    });
  });

  it('uses explicit action, range, and target controls', async () => {
    let now = 1;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);
    const mock = makeCombatClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);
    await screen.findByText('No combatants yet.');

    fireEvent.change(screen.getByPlaceholderText(/Pirate/), { target: { value: 'Corsair' } });
    fireEvent.change(screen.getByPlaceholderText('auto'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'ADD NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'ALLY' }));
    fireEvent.change(screen.getByPlaceholderText(/Pirate/), { target: { value: 'Marine' } });
    fireEvent.change(screen.getByPlaceholderText('auto'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'ADD NPC' }));

    const corsairCard = screen.getByLabelText('Corsair combatant card');
    fireEvent.click(within(corsairCard).getByRole('button', { name: /DETAILS/i }));

    fireEvent.click(within(corsairCard).getByRole('button', { name: /Minor/i }));
    expect(within(corsairCard).getByText('USED')).toBeTruthy();

    fireEvent.change(within(corsairCard).getByLabelText(/Range/i), { target: { value: 'medium' } });
    expect((within(corsairCard).getByLabelText(/Range/i) as HTMLSelectElement).value).toBe('medium');

    fireEvent.change(within(corsairCard).getByLabelText(/Target/i), { target: { value: 'npc-2' } });
    expect((within(corsairCard).getByLabelText(/Target/i) as HTMLSelectElement).value).toBe('npc-2');
    expect(within(corsairCard).getByTitle('Target Marine')).toBeTruthy();
  });

  it('keeps collapsed PC cards round-focused and moves stats, skills, and weapons to details', async () => {
    const mock = makeCombatClient([{
      id: 'char-1',
      name: 'Ace',
      str: 9,
      dex: 11,
      end_stat: 11,
      int_stat: 8,
      edu: 10,
      soc: 4,
      str_cur: null,
      dex_cur: 9,
      end_cur: 10,
      temp_mods: null,
      skills: [
        { name: 'Gun Combat (Slug)', level: 2 },
        { name: 'Melee (Blade)', level: 1 },
        { name: 'Admin', level: 1 },
      ],
      weapons: [
        { name: 'Accelerator Rifle', skill: 'Gun Combat (Slug)', range: '450m', damage: '3D', traits: 'Auto 2' },
      ],
    }]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);

    fireEvent.click(await screen.findByRole('button', { name: '+ Ace' }));

    const aceCard = screen.getByLabelText('Ace combatant card');
    expect(within(aceCard).getByText(/E10\/S9\/D9/)).toBeTruthy();
    expect(within(aceCard).queryByText(/UPP 9BB8A4/)).toBeNull();
    expect(within(aceCard).queryByText(/Gun \(Slug\)-2/)).toBeNull();
    expect(within(aceCard).queryByText(/Accelerator Rifle 3D/)).toBeNull();

    fireEvent.click(within(aceCard).getByRole('button', { name: /DETAILS/i }));

    expect(within(aceCard).getByText(/UPP 9BB8A4/)).toBeTruthy();
    expect(within(aceCard).getByText(/Gun \(Slug\)-2/)).toBeTruthy();
    expect(within(aceCard).getByTitle(/Gun Combat \(Slug\)-2/)).toBeTruthy();
    expect(within(aceCard).queryByText(/Admin-1/)).toBeNull();
    expect(within(aceCard).getByText(/Accelerator Rifle 3D/)).toBeTruthy();
  });

  it('rolls clicked weapon damage against the selected target and subtracts worn armor', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mock = makeCombatClient([
      {
        id: 'char-1',
        name: 'Ace',
        str: 9,
        dex: 11,
        end_stat: 11,
        int_stat: 8,
        edu: 10,
        soc: 4,
        str_cur: 9,
        dex_cur: 11,
        end_cur: 11,
        temp_mods: null,
        skills: [{ name: 'Gun Combat (Slug)', level: 2 }],
        weapons: [
          { name: 'Accelerator Rifle', skill: 'Gun Combat (Slug)', range: '450m', damage: '3D', traits: 'Auto 2' },
        ],
        armour: [],
      },
      {
        id: 'char-2',
        name: 'Guard',
        str: 7,
        dex: 7,
        end_stat: 7,
        int_stat: 7,
        edu: 7,
        soc: 7,
        str_cur: 7,
        dex_cur: 7,
        end_cur: 7,
        temp_mods: null,
        skills: [],
        weapons: [
          { name: 'Blade', skill: 'Melee (Blade)', range: 'Melee', damage: '2D', traits: '' },
        ],
        armour: [
          { worn: true, name: 'Jack', protection: 2, radiation: null, required_skill: null },
        ],
      },
    ]);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<CombatTracker />);

    fireEvent.click(await screen.findByRole('button', { name: '+ Ace' }));
    fireEvent.click(await screen.findByRole('button', { name: '+ Guard' }));

    const aceCard = screen.getByLabelText('Ace combatant card');
    const guardCard = screen.getByLabelText('Guard combatant card');
    fireEvent.click(within(guardCard).getByRole('button', { name: /DETAILS/i }));
    expect(within(guardCard).getByRole('button', { name: /Blade 2D/i })).toBeDisabled();
    expect(within(guardCard).getByRole('button', { name: /Minor/i })).toBeDisabled();
    fireEvent.click(within(aceCard).getByRole('button', { name: /DETAILS/i }));
    fireEvent.change(within(aceCard).getByLabelText(/Target/i), { target: { value: 'char-2' } });
    fireEvent.click(within(aceCard).getByRole('button', { name: /Accelerator Rifle 3D/i }));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Ace -> Guard');
      expect(document.body.textContent).toContain('armor 2');
      expect(document.body.textContent).toContain('7 applied');
      expect(within(screen.getByLabelText('Guard combatant card')).getAllByText(/E0\/S7\/D7/).length).toBeGreaterThan(0);
    });
  });
});
