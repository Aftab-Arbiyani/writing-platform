import type { ReactElement } from 'react';

/** First tab stop → jumps to <main> (docs/06 §2, docs/34 §2.2). Visually hidden until focused. */
export function SkipLink(): ReactElement {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-surface px-3 py-2 text-sm text-ink shadow-[var(--q-shadow-2)] focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50"
    >
      Skip to content
    </a>
  );
}
