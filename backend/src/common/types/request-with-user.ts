import type { Request } from 'express';

/**
 * Placeholder request typing for authenticated routes. The Phase-1 auth module
 * (JWT guard) will populate `user` from the verified access token — until
 * then nothing sets it, hence optional. The shape will grow (roles, etc.)
 * alongside the RBAC decorators.
 */
export interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}
