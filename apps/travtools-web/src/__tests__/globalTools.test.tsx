import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlobalToolsDrawer from '../components/tools/GlobalToolsDrawer';
import * as SupabaseContext from '../lib/supabaseContext';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GlobalToolsDrawer', () => {
  it('adjusts the standalone check modifier with mouse controls', async () => {
    vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
      client: null,
      isConfigured: true,
      configure: vi.fn(),
      reset: vi.fn(),
    });

    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    expect(screen.getByText('MODIFIER')).toBeTruthy();
    const input = screen.getByLabelText('Standalone Modifier') as HTMLInputElement;

    expect(input.value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: /Increase standalone modifier/i }));
    await waitFor(() => expect(input.value).toBe('1'));
    fireEvent.click(screen.getByRole('button', { name: /Decrease standalone modifier/i }));
    await waitFor(() => expect(input.value).toBe('0'));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Decrease standalone modifier/i }));
    await waitFor(() => expect(input.value).toBe('-1'));
  });
});
