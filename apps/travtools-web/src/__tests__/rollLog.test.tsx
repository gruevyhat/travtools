import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import RollLog, { relTime } from '../components/log/RollLog';
import type { RollLogEntry } from '../types';
import * as SupabaseContext from '../lib/supabaseContext';

const NOW = new Date('2026-06-07T12:00:00Z').getTime();

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

describe('relTime', () => {
  it('formats seconds ago', () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 45_000).toISOString();
    expect(relTime(iso)).toBe('45s ago');
  });

  it('formats minutes ago', () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(relTime(iso)).toBe('5m ago');
  });

  it('formats hours ago', () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(relTime(iso)).toBe('3h ago');
  });

  it('formats days ago', () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 2 * 86_400_000).toISOString();
    expect(relTime(iso)).toBe('2d ago');
  });

  it('formats a date for entries older than 7 days', () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 10 * 86_400_000).toISOString();
    const result = relTime(iso);
    expect(result).toMatch(/May/);
  });
});

describe('RollLog', () => {
  it('clears all roll log entries after styled in-app confirmation', async () => {
    const mock = makeRollLogClient(baseEntries);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<RollLog />);

    expect(await screen.findByText('Rafael')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /CLEAR LOG/i }));
    expect(screen.getByRole('button', { name: /CONFIRM/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /CONFIRM/i }));

    await waitFor(() => {
      expect(mock.deleteFn).toHaveBeenCalled();
      expect(mock.not).toHaveBeenCalledWith('id', 'is', null);
    });
    expect(screen.getByText('0 ROLLS RECORDED')).toBeTruthy();
    expect(screen.queryByText('Rafael')).toBeNull();
  });

  it('cancels the clear confirmation without deleting', async () => {
    const mock = makeRollLogClient(baseEntries);
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: mock.client as never,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
      session: null,
      user: null,
      canEdit: true,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<RollLog />);
    expect(await screen.findByText('Rafael')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /CLEAR LOG/i }));
    fireEvent.click(screen.getByRole('button', { name: /CANCEL/i }));

    expect(mock.deleteFn).not.toHaveBeenCalled();
    expect(screen.getByText('Rafael')).toBeTruthy();
  });
});
