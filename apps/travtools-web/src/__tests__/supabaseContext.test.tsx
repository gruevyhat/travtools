import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SupabaseProvider, useSupabase } from '../lib/supabaseContext';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mock: 'client' })),
}));

function Probe() {
  const ctx = useSupabase();
  return (
    <div>
      <span data-testid="configured">{String(ctx.isConfigured)}</span>
      <button onClick={() => ctx.configure('https://test.supabase.co', 'test-key')}>configure</button>
      <button onClick={ctx.reset}>reset</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

describe('SupabaseProvider', () => {
  it('starts unconfigured when no env vars or localStorage', () => {
    const { getByTestId } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    expect(getByTestId('configured').textContent).toBe('false');
  });

  it('becomes configured after configure() is called', async () => {
    const { getByTestId, getByText } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    await act(async () => { getByText('configure').click(); });
    expect(getByTestId('configured').textContent).toBe('true');
  });

  it('persists config to localStorage', async () => {
    const { getByText } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    await act(async () => { getByText('configure').click(); });
    expect(localStorage.getItem('tt_sb_url')).toBe('https://test.supabase.co');
    expect(localStorage.getItem('tt_sb_key')).toBe('test-key');
  });

  it('resets to unconfigured after reset()', async () => {
    const { getByTestId, getByText } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    await act(async () => { getByText('configure').click(); });
    await act(async () => { getByText('reset').click(); });
    expect(getByTestId('configured').textContent).toBe('false');
    expect(localStorage.getItem('tt_sb_url')).toBeNull();
  });

  it('restores from localStorage on mount', () => {
    localStorage.setItem('tt_sb_url', 'https://stored.supabase.co');
    localStorage.setItem('tt_sb_key', 'stored-key');
    const { getByTestId } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    expect(getByTestId('configured').textContent).toBe('true');
  });
});
