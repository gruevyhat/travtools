import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NumberStepper from '../components/shared/NumberStepper';

describe('NumberStepper', () => {
  it('prevents mouse down from starting text selection on step controls', () => {
    const onChange = vi.fn();
    render(<NumberStepper ariaLabel="Test Value" value={0} onChange={onChange} />);

    const increase = screen.getByRole('button', { name: 'Increase value' });
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const dispatched = increase.dispatchEvent(event);

    expect(dispatched).toBe(false);
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(increase);
    expect(onChange).toHaveBeenCalledWith('1');
  });
});
