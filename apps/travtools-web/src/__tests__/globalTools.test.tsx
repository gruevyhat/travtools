import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlobalToolsDrawer from '../components/tools/GlobalToolsDrawer';
import * as SupabaseContext from '../lib/supabaseContext';

function mockSupabase() {
  vi.spyOn(SupabaseContext, 'useSupabase').mockReturnValue({
    client: null,
    isConfigured: true,
    configure: vi.fn(),
    reset: vi.fn(),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GlobalToolsDrawer', () => {
  it('adjusts the standalone check modifier with mouse controls', async () => {
    mockSupabase();
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

describe('Notation Roller section (Dice tab)', () => {
  it('renders the notation input on the Dice tab', () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);
    // Dice tab is active by default — notation roller is visible without extra clicks
    expect(screen.getByLabelText('Dice notation expression')).toBeTruthy();
  });

  it('shows a roll result after entering valid notation and clicking ROLL NOTATION', async () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    const input = screen.getByLabelText('Dice notation expression') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3d6+2' } });
    fireEvent.click(screen.getByRole('button', { name: /ROLL NOTATION/i }));

    await waitFor(() => {
      const panels = screen.queryAllByText(/^\d+$/);
      expect(panels.length).toBeGreaterThan(0);
    });
  });

  it('shows an inline error for invalid notation without crashing', async () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    const input = screen.getByLabelText('Dice notation expression') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-valid-notation!!!' } });
    fireEvent.click(screen.getByRole('button', { name: /ROLL NOTATION/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('ROLL NOTATION button is disabled when the notation input is empty', () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    const rollBtn = screen.getByRole('button', { name: /ROLL NOTATION/i }) as HTMLButtonElement;
    expect(rollBtn.disabled).toBe(true);
  });

  it('submits on Enter key in the notation input', async () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    const input = screen.getByLabelText('Dice notation expression') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2d6' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const panels = screen.queryAllByText(/^\d+$/);
      expect(panels.length).toBeGreaterThan(0);
    });
  });

  it('toggles the syntax help panel', async () => {
    mockSupabase();
    render(<GlobalToolsDrawer open onClose={vi.fn()} />);

    expect(screen.queryByText(/Roll X dice/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /SYNTAX REFERENCE/i }));
    await waitFor(() => expect(screen.getByText(/Roll X dice/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /SYNTAX REFERENCE/i }));
    await waitFor(() => expect(screen.queryByText(/Roll X dice/)).toBeNull());
  });
});
