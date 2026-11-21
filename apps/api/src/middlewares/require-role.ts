import type { UserRole } from '@snapia/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/app-error';

/** Allows only users with one of the given global roles. Use it after authenticate. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (req.auth === undefined) {
      throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
    }
    if (!roles.includes(req.auth.role)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to do this', 403);
    }
    next();
  };
}
