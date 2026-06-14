import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NPCGenerator from '../components/npc/NPCGenerator';
import * as SupabaseContext from '../lib/supabaseContext';

function makeNpcClient() {
  const order = vi.fn(async () => ({ data: [], error: null }));
  const selectNpcs = vi.fn(() => ({ order }));
  const single = vi.fn(async () => ({
    data: {
      id: 'npc-1',
      name: 'Edited NPC',
      race: 'Human',
      archetype: 'Custom long-form fixer and information broker',
      quirk: 'Speaks in long, wrapped sentences that should remain readable.',
      experience_level: 'Experienced',
      str: 7,
      dex: 7,
      end_stat: 7,
      int_stat: 7,
      edu: 7,
      soc: 7,
      skills: [],
      notes: 'Speaks in long, wrapped sentences that should remain readable.',
      created_at: '2026-06-14T00:00:00Z',
    },
    error: null,
  }));
  const selectInserted = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectInserted }));

  return {
    client: {
      from: vi.fn(() => ({ select: selectNpcs, insert })),
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

describe('NPCGenerator', () => {
  it('saves edited archetype and quirk text', async () => {
    const mock = makeNpcClient();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<NPCGenerator />);

    fireEvent.change(screen.getByLabelText('NPC Archetype'), {
      target: { value: 'Custom long-form fixer and information broker' },
    });
    fireEvent.change(screen.getByLabelText('NPC Quirk'), {
      target: { value: 'Speaks in long, wrapped sentences that should remain readable.' },
    });
    fireEvent.change(screen.getByPlaceholderText('NPC name'), {
      target: { value: 'Edited NPC' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'SAVE NPC' }));

    await waitFor(() => expect(mock.insert).toHaveBeenCalledTimes(1));
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Edited NPC',
      archetype: 'Custom long-form fixer and information broker',
      quirk: 'Speaks in long, wrapped sentences that should remain readable.',
      notes: 'Speaks in long, wrapped sentences that should remain readable.',
    }));
  });
});
