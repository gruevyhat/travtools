import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mock: 'client' })),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

describe('App', () => {
  it('renders SetupScreen when Supabase is not configured', () => {
    render(<App />);
    expect(screen.getByText('TRAVTOOLS')).toBeTruthy();
    expect(screen.getByText(/SETUP REQUIRED/i)).toBeTruthy();
  });

  it('shows the connect button on the setup screen', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /CONNECT/i })).toBeTruthy();
  });
});
