import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

import { REQUEST_ID_HEADER } from '../constants/http.constants';

/**
 * Request-id correlation (ADR §9). Runs first (registered ahead of the pino
 * logger in `CommonModule`), so every request carries a stable id that unifies
 * nginx → API → BullMQ job → Sentry with a single grep.
 *
 * - Honors an incoming `X-Request-Id` from a trusted proxy; otherwise mints a
 *   UUIDv7 (time-ordered, matching our PK strategy).
 * - Writes the id back onto the request header so `nestjs-pino`'s `genReqId`
 *   (which reads `x-request-id`) binds the same id to the request-scoped logger.
 * - Echoes it on the response header — the half Phase 0 left unset.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? uuidv7();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
