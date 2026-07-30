import type { CursorMeta, OffsetMeta } from '@qalam/shared';

/**
 * Service/repository return shapes for paginated reads. Controllers map these
 * onto the ADR §5 envelope's `data` + `meta` (the `TransformInterceptor` never
 * synthesizes pagination — list handlers attach `meta` explicitly).
 */

/** A page of cursor-paginated rows (feeds, timelines, notifications). */
export interface CursorPage<TItem> {
  items: TItem[];
  meta: CursorMeta;
}

/** A page of offset-paginated rows (admin tables). */
export interface OffsetPage<TItem> {
  items: TItem[];
  meta: OffsetMeta;
}
