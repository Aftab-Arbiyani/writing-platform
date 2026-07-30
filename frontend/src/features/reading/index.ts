/**
 * Public surface of the reading feature (docs/26 §4) — the reading view at `/p/:slug` (W1,
 * docs/45 §4.1). Imported by the lazy `piece` route module. Reader typography is this feature's
 * own device-scoped store; engagement and the author card are TanStack Query hooks sharing the
 * app-wide `qk.pieces.*` / `qk.profiles.*` keys, so the feature stays deletable with one `rm -rf`.
 */
export { PiecePage } from './pages/piece-page';
export { ContentRenderer } from './components/content-renderer';
export { usePiece, usePieceEngagement } from './hooks/use-piece';
export type { PieceDetail, PieceEngagement, RelatedPiece, TipTapNode } from './types/reading.types';
