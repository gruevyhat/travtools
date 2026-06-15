import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SupabaseProvider, useSupabase } from '../lib/supabaseContext';

const mockUnsubscribe = vi.fn();

function makeMockClient(isAllowedEditor = false) {
  return {
    mock: 'client',
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn().mockResolvedValue({ data: isAllowedEditor }),
  };
}

let mockClient = makeMockClient();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

function Probe() {
  const ctx = useSupabase();
  return (
    <div>
      <span data-testid="configured">{String(ctx.isConfigured)}</span>
      <span data-testid="canEdit">{String(ctx.canEdit)}</span>
      <span data-testid="authReady">{String(ctx.authReady)}</span>
      <span data-testid="session">{ctx.session ? 'has-session' : 'no-session'}</span>
      <button onClick={() => ctx.configure('https://test.supabase.co', 'test-key')}>configure</button>
      <button onClick={ctx.reset}>reset</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  mockUnsubscribe.mockClear();
  mockClient = makeMockClient();
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

  it('defaults canEdit to false when no session', async () => {
    localStorage.setItem('tt_sb_url', 'https://stored.supabase.co');
    localStorage.setItem('tt_sb_key', 'stored-key');
    const { getByTestId } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    await waitFor(() => expect(getByTestId('authReady').textContent).toBe('true'));
    expect(getByTestId('canEdit').textContent).toBe('false');
  });

  it('sets authReady to true after session resolves even when unconfigured', async () => {
    const { getByTestId } = render(
      <SupabaseProvider><Probe /></SupabaseProvider>
    );
    await waitFor(() => expect(getByTestId('authReady').textContent).toBe('true'));
    expect(getByTestId('canEdit').textContent).toBe('false');
  });
});
