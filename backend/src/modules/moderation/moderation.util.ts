import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { ModerationActor } from './moderation.service';

/** Builds the audited moderation actor from the request context (best-effort). */
export function buildActor(user: AuthenticatedUser, req: Request): ModerationActor {
  const requestId = req.headers['x-request-id'];
  return {
    id: user.id,
    role: user.role,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}
