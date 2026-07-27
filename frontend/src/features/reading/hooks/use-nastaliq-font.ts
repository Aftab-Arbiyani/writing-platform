import { useEffect } from 'react';

/**
 * Lazily loads the Nastaliq face when — and only when — the piece being read is set in it
 * (docs/07 §Typography, font-loading table: *"**Lazy**: `@fontsource/noto-nastaliq-urdu`
 * imported by the Urdu reading surface on demand (it is the heaviest face in the system)"*).
 *
 * The reading view is that surface. Eagerly `@import`-ing it in `global.css` would tax every
 * session — including the majority that never render an Urdu glyph — with the largest font in
 * the system, so the import is dynamic and fires from the piece's own script.
 *
 * `--q-font-serif` already lists `'Noto Nastaliq Urdu'` ahead of the generic serif, so nothing
 * needs to change once the face arrives: the browser re-renders the prose in it. FOUT is the
 * accepted policy for reading faces (same table) — we never block paint on a font.
 */
export function useNastaliqFont(script: string | null | undefined): void {
  const nastaliq = script?.toLowerCase() === 'nastaliq';

  useEffect(() => {
    if (!nastaliq) return;
    // Fire-and-forget: a font that fails to load falls back down the stack, which is a
    // degraded rendering, not a broken page.
    void import('@fontsource/noto-nastaliq-urdu/400.css').catch(() => {
      /* keep the fallback face */
    });
  }, [nastaliq]);
}
