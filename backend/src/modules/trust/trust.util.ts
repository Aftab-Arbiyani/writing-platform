import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { TrustActor } from './trust.service';

/** Builds the audited trust actor from the request context (best-effort). */
export function buildActor(user: AuthenticatedUser, req: Request): TrustActor {
  const requestId = req.headers['x-request-id'];
  return {
    id: user.id,
    role: user.role,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}
