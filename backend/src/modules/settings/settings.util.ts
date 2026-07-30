import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/** The audited actor behind a settings mutation, resolved from the request. */
export interface SettingsActor {
  id: string;
  role: string;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/** Builds the audited actor from the request context (best-effort; cf. moderation). */
export function buildActor(user: AuthenticatedUser, req: Request): SettingsActor {
  const requestId = req.headers['x-request-id'];
  return {
    id: user.id,
    role: user.role,
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    requestId: typeof requestId === 'string' ? requestId : null,
  };
}
