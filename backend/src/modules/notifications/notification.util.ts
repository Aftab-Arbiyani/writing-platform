import { decodeCursor, type CursorPayload } from '../../common/pagination/cursor.util';
import { NotificationInvalidCursorException } from './notifications.exceptions';

/**
 * Cursor contract for the inbox (docs 05 §5.1): absent → first page;
 * present-but-malformed → 400 (client restarts from page one).
 */
export function parseNotificationCursor(raw: string | undefined): CursorPayload | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const decoded = decodeCursor(raw);
  if (decoded === null) {
    throw new NotificationInvalidCursorException();
  }
  return decoded;
}

/** Splits an array into fixed-size chunks (broadcast fan-out). */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
