/**
 * Opaque keyset cursor codec (docs 05 §5.1). A cursor is base64url of the sort
 * key + id of the last item served:
 *
 *   cursor = base64url(JSON.stringify({ k: "<sortKey>", id: "<uuid>" }))
 *
 * executed downstream as `WHERE (sort_key, id) < ($k, $id)`. Clients treat
 * cursors as opaque — the encoding may change without notice; only round-tripping
 * is guaranteed.
 *
 * Pure functions (no NestJS deps) so they are unit-testable in isolation and
 * usable from any repository. `decodeCursor` returns `null` on any malformation;
 * the caller decides the error (feeds throw `FEED_INVALID_CURSOR`, Epic 6) —
 * this keeps the codec decoupled from the error catalogue.
 */

/** The decoded keyset position: sort-key value (as string) + tiebreaker id. */
export interface CursorPayload {
  /** Sort-key value of the last row (ISO date, score, etc.) as a string. */
  k: string;
  /** UUID of the last row — the stable tiebreaker. */
  id: string;
}

/** Encodes a keyset position into an opaque base64url cursor. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Decodes an opaque cursor, or returns `null` if it is missing/malformed. */
export function decodeCursor(raw: string | undefined | null): CursorPayload | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'k' in parsed &&
      'id' in parsed &&
      typeof (parsed as Record<string, unknown>).k === 'string' &&
      typeof (parsed as Record<string, unknown>).id === 'string'
    ) {
      const { k, id } = parsed as Record<'k' | 'id', string>;
      return { k, id };
    }

    return null;
  } catch {
    // Malformed base64 or JSON — an opaque cursor the client must not have hand-built.
    return null;
  }
}
