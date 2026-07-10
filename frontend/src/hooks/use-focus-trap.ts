import { useEffect, useRef, type RefObject } from 'react';

/** Elements that can receive keyboard focus (excludes disabled + programmatic-only tabindex=-1). */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Trap keyboard focus inside a custom (non-AntD) dialog while `active` (WCAG 2.4.3 / 4.1.2).
 * On activate: remembers the currently focused element, moves focus to the first focusable inside
 * (or the container itself). While active: Tab / Shift+Tab cycle within the container. On
 * deactivate/unmount: restores focus to the element that opened the dialog.
 *
 * The container must be focusable — give it `tabIndex={-1}`. AntD `Modal`/`QDialog` already trap,
 * so this is only for hand-rolled overlays (e.g. the editor's full-page preview).
 */
export function useFocusTrap<T extends HTMLElement>(active = true): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getAttribute('aria-hidden') !== 'true',
      );

    // Move focus into the dialog.
    (focusables()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        container.focus();
        return;
      }
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return ref;
}
