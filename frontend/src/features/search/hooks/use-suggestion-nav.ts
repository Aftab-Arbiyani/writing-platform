import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

/**
 * Roving keyboard navigation for the search command list (docs/06 §3.6, docs/07 §13 a11y).
 * Models a combobox: ArrowDown/ArrowUp move a virtual highlight over `count` options (index
 * −1 = the raw input, no option highlighted), Enter activates the highlighted option or, at
 * −1, submits the typed query, Escape closes. The active index resets whenever the option set
 * changes size (a new suggestion list) so the highlight never points past the end.
 *
 * The hook owns only the index + key handling; the component owns rendering + `aria-activedescendant`.
 */
interface UseSuggestionNavOptions {
  /** Number of navigable options currently rendered. */
  count: number;
  /** Activate the option at `index` (0-based). */
  onSelect: (index: number) => void;
  /** Enter pressed with nothing highlighted → run the typed query. */
  onSubmit: () => void;
  /** Escape pressed. */
  onEscape: () => void;
}

export interface UseSuggestionNavResult {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  reset: () => void;
}

export function useSuggestionNav({
  count,
  onSelect,
  onSubmit,
  onEscape,
}: UseSuggestionNavOptions): UseSuggestionNavResult {
  const [activeIndex, setActiveIndex] = useState(-1);

  // A shorter/different list must never leave the highlight dangling past the end.
  useEffect(() => {
    setActiveIndex((current) => (current >= count ? count - 1 : current));
  }, [count]);

  const reset = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((current) => (count === 0 ? -1 : Math.min(count - 1, current + 1)));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((current) => Math.max(-1, current - 1));
          break;
        case 'Enter':
          // Let a highlighted option win; otherwise submit the typed query.
          if (activeIndex >= 0 && activeIndex < count) {
            event.preventDefault();
            onSelect(activeIndex);
          } else {
            onSubmit();
          }
          break;
        case 'Escape':
          event.preventDefault();
          onEscape();
          break;
        default:
          break;
      }
    },
    [activeIndex, count, onSelect, onSubmit, onEscape],
  );

  return { activeIndex, setActiveIndex, handleKeyDown, reset };
}
