import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

/** Success envelope from ADR §5. `meta` carries pagination cursors/totals. */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** True for any payload already carrying the envelope discriminator. */
function isEnveloped(value: unknown): value is { success: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

/**
 * Globally registered (main.ts). Wraps every controller return value in
 * { success: true, data }. Handlers that already return an envelope — e.g.
 * paginated endpoints attaching `meta` — pass through untouched. Failures
 * never reach this interceptor; the AllExceptionsFilter owns those.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessEnvelope<T> | T> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessEnvelope<T> | T> {
    return next
      .handle()
      .pipe(
        map((payload) =>
          isEnveloped(payload) ? payload : { success: true as const, data: payload },
        ),
      );
  }
}
