import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

// Regression: the Modal focus-trap effect used to depend on `onClose`. Callers
// pass an inline arrow (new function every render), so it re-ran on every
// keystroke and yanked focus out of the field — you could only type ONE
// character. This asserts focus stays on the field across multiple keystrokes.
describe('Modal keeps focus while typing (inline onClose)', () => {
  function Harness() {
    const [v, setV] = useState('');
    return (
      <Modal open title="New thing" onClose={() => {}}>
        <input aria-label="title" value={v} onChange={(e) => setV(e.target.value)} />
      </Modal>
    );
  }

  it('does not lose focus after each character', () => {
    render(<Harness />);
    const input = screen.getByLabelText('title');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'H' } });
    expect(document.activeElement).toBe(input); // would fail with the old effect
    fireEvent.change(input, { target: { value: 'He' } });
    fireEvent.change(input, { target: { value: 'Hello' } });

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Hello');
  });
});
