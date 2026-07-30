import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

/**
 * Abstract base for all domain errors. Phase-1 modules subclass it, e.g.:
 *
 *   export class PieceNotFoundException extends AppException {
 *     constructor(slug: string) {
 *       super('PIECE_NOT_FOUND', `Piece "${slug}" was not found.`, HttpStatus.NOT_FOUND);
 *     }
 *   }
 *
 * `code` must come from the ERROR_CODES catalogue in @qalam/shared
 * (DOMAIN_REASON format, ADR §5 — e.g. AUTH_INVALID_CREDENTIALS) so clients
 * switch on stable identifiers, never on message text. The AllExceptionsFilter
 * maps instances onto the error envelope; the HTTP status stays meaningful.
 */
export abstract class AppException extends HttpException {
  protected constructor(
    /** Stable catalogue code from @qalam/shared ERROR_CODES. */
    public readonly code: string,
    message: string,
    status: HttpStatus,
    /** Structured context that is safe to expose to clients (field errors etc.). */
    public readonly details: unknown[] = [],
  ) {
    super(message, status);
  }
}
