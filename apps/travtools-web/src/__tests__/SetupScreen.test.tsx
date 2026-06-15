import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SetupScreen from '../components/SetupScreen';
import * as SupabaseContext from '../lib/supabaseContext';

describe('SetupScreen', () => {
  it('calls configure() with url and key on valid submit', () => {
    const configure = vi.fn();
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      configure,
      reset: vi.fn(),
      client: null,
      isConfigured: false,
      session: null,
      user: null,
      canEdit: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<SetupScreen />);

    fireEvent.change(screen.getByPlaceholderText(/xxxxxxxxxxxx\.supabase\.co/), {
      target: { value: 'https://proj.supabase.co' },
    });
    fireEvent.change(screen.getByPlaceholderText(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/), {
      target: { value: 'anon-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /CONNECT/i }));

    expect(configure).toHaveBeenCalledWith('https://proj.supabase.co', 'anon-key');
  });

  it('shows an error when URL is not https://', () => {
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      configure: vi.fn(),
      reset: vi.fn(),
      client: null,
      isConfigured: false,
      session: null,
      user: null,
      canEdit: false,
      authReady: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });

    render(<SetupScreen />);

    fireEvent.change(screen.getByPlaceholderText(/xxxxxxxxxxxx\.supabase\.co/), {
      target: { value: 'http://bad-url.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/), {
      target: { value: 'key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /CONNECT/i }));

    expect(screen.getByText(/valid Supabase project URL/i)).toBeTruthy();
  });
});
