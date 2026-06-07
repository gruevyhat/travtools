import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import RollLog from '../components/log/RollLog';
import type { RollLogEntry } from '../types';
import * as SupabaseContext from '../lib/supabaseContext';

const baseEntries: RollLogEntry[] = [
  {
    id: 'roll-1',
    character_name: 'Rafael',
    check_label: 'Pilot',
    d1: 4,
    d2: 5,
    char_dm: 1,
    skill_level: 2,
    bonus_dm: 0,
    total: 12,
    difficulty: 8,
    success: true,
    effect: 4,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function makeRollLogClient(initialEntries: RollLogEntry[] = []) {
  let entries = [...initialEntries];
  const limit = vi.fn(async () => ({ data: entries, error: null }));
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const not = vi.fn(async () => {
    entries = [];
    return { error: null };
  });
  const deleteFn = vi.fn(() => ({ not }));

  return {
    client: {
      from: vi.fn(() => ({ select, delete: deleteFn })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
    deleteFn,
    not,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RollLog', () => {
  it('clears all roll log entries after confirmation', async () => {
    const mock = makeRollLogClient(baseEntries);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<RollLog />);

    expect(await screen.findByText('Rafael')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /CLEAR LOG/i }));

    await waitFor(() => {
      expect(mock.deleteFn).toHaveBeenCalled();
      expect(mock.not).toHaveBeenCalledWith('id', 'is', null);
    });
    expect(screen.getByText('0 ROLLS RECORDED')).toBeTruthy();
    expect(screen.queryByText('Rafael')).toBeNull();
  });
});
