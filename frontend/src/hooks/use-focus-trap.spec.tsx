import { fireEvent, render } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { useFocusTrap } from './use-focus-trap';

function Dialog(): ReactElement {
  const ref = useFocusTrap<HTMLDivElement>();
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label="Test">
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button">Third</button>
    </div>
  );
}

function Harness(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? <Dialog /> : null}
      <button type="button" onClick={() => setOpen(false)}>
        Unmount
      </button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element on mount', () => {
    render(<Dialog />);
    expect(document.activeElement).toHaveTextContent('First');
  });

  it('cycles focus with Tab and Shift+Tab', () => {
    render(<Dialog />);
    const buttons = Array.from(document.querySelectorAll('button'));
    const first = buttons[0]!;
    const third = buttons[2]!;

    // Tab from the last element wraps to the first.
    third.focus();
    fireEvent.keyDown(third, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first element wraps to the last.
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(third);
  });

  it('restores focus to the trigger when the dialog unmounts', () => {
    const { getByText } = render(<Harness />);
    const opener = getByText('Open');
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener); // mounts the dialog → focus moves inside
    expect(document.activeElement).toHaveTextContent('First');

    fireEvent.click(getByText('Unmount')); // unmounts → focus restored to opener
    expect(document.activeElement).toBe(opener);
  });
});
