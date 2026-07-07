import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter, LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from '../exceptions/app.exception';

/** Error envelope from ADR §5 — the only failure shape this API ever emits. */
export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
    requestId: string;
  };
}

/**
 * pino-http decorates the request with the generated/propagated request id;
 * intersection (not extension) stays compatible with its `ReqId` augmentation.
 */
type RequestWithId = Request & { id?: unknown };

/**
 * Catch-all filter (registered globally in main.ts) that maps every thrown
 * value onto the ADR §5 error envelope:
 *
 * - AppException  → its catalogue code / message / details pass through.
 * - HttpException → code derived from the HTTP status (e.g. NOT_FOUND);
 *                   ValidationPipe message arrays surface as `details`.
 * - anything else → 500 INTERNAL_SERVER_ERROR with a generic message —
 *                   internals are logged, never leaked to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const headerId = request.headers['x-request-id'];
    const requestId = String(
      request.id ?? (Array.isArray(headerId) ? headerId[0] : headerId) ?? 'unknown',
    );

    let status: number;
    let code: string;
    let message: string;
    let details: unknown[] = [];

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Reverse enum lookup gives a stable, screaming-snake code: 404 → NOT_FOUND.
      code = (HttpStatus[status] as string | undefined) ?? 'HTTP_ERROR';
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else {
        const body = payload as { message?: string | string[] };
        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          details = body.message;
        } else {
          message = body.message ?? exception.message;
        }
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred.';
    }

    // 5xx are bugs or outages — log with stack; 4xx are normal API traffic.
    if (status >= 500) {
      this.logger.error(
        `Unhandled ${status} on ${request.method} ${request.url} [requestId=${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const envelope: ApiErrorEnvelope = {
      success: false,
      error: { code, message, details, requestId },
    };

    response.status(status).json(envelope);
  }
}
