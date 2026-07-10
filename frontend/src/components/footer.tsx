import type { ReactElement } from 'react';

/** Minimal footer (docs/06 §4.2 — feeds have no footer; legal lives here + landing). */
export function Footer(): ReactElement {
  return (
    <footer
      data-print-hidden
      className="border-line border-t py-6 text-center text-xs text-ink-secondary"
    >
      <p>© {String(new Date().getFullYear())} Qalam — a writing sanctuary.</p>
    </footer>
  );
}
