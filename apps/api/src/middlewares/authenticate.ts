import type { UserRole } from '@snapia/shared';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/app-error';

/** The signed-in user of a request (req.auth). */
export interface AuthContext {
  userId: string;
  username: string;
  role: UserRole;
}

export interface AuthMiddlewareDependencies {
  /** Verifies an access token and returns its user id, or null when it is invalid or expired. */
  verifyAccessToken: (token: string) => Promise<string | null>;
  /** Loads the current role and state of a user; null when the user does not exist. */
  findUser: (
    id: string,
  ) => Promise<{ id: string; username: string; role: UserRole; isActive: boolean } | null>;
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

function unauthenticated(message = 'Sign in to continue'): AppError {
  return new AppError('UNAUTHENTICATED', message, 401);
}

/**
 * authenticate: the request needs a valid `Authorization: Bearer <access token>` (401 otherwise).
 * optionalAuth: for public routes that change with a session; no header means anonymous.
 * Both load the user on every request, so deactivations and role changes apply at once.
 */
export function createAuthMiddlewares({ verifyAccessToken, findUser }: AuthMiddlewareDependencies) {
  /** The AuthContext of the request, null without Authorization header; throws on a bad token. */
  async function resolveAuth(req: Request): Promise<AuthContext | null> {
    const header = req.get('Authorization');
    if (header === undefined) return null;

    const token = BEARER_PATTERN.exec(header)?.[1];
    if (token === undefined) throw unauthenticated('Use the header Authorization: Bearer <token>');

    const userId = await verifyAccessToken(token);
    const user = userId === null ? null : await findUser(userId);
    if (user === null || !user.isActive) throw unauthenticated('Invalid or expired access token');

    return { userId: user.id, username: user.username, role: user.role };
  }

  const authenticate: RequestHandler = async (req, _res, next) => {
    const auth = await resolveAuth(req);
    if (auth === null) throw unauthenticated();
    req.auth = auth;
    next();
  };

  const optionalAuth: RequestHandler = async (req, _res, next) => {
    const auth = await resolveAuth(req);
    if (auth !== null) req.auth = auth;
    next();
  };

  return { authenticate, optionalAuth };
}

export type AuthMiddlewares = ReturnType<typeof createAuthMiddlewares>;

/** The signed-in user of a request that went through authenticate. */
export function requireAuth(req: Request): AuthContext {
  if (req.auth === undefined) throw unauthenticated();
  return req.auth;
}
