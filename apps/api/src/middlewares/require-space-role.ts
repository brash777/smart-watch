import type { SpaceRole, Visibility } from '@snapia/shared';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/app-error';

/** VIEWER < EDITOR < OWNER. */
const ROLE_ORDER: readonly SpaceRole[] = ['VIEWER', 'EDITOR', 'OWNER'];

/** True when `role` is at least `minRole`. */
export function hasSpaceRole(role: SpaceRole, minRole: SpaceRole): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minRole);
}

/**
 * What a user may do in a Space: members act with their own role; anyone else may only
 * view a PUBLIC Space (as a VIEWER) and has no access to the others.
 */
export function effectiveSpaceRole(
  visibility: Visibility,
  memberRole: SpaceRole | null,
): SpaceRole | null {
  if (memberRole !== null) return memberRole;
  return visibility === 'PUBLIC' ? 'VIEWER' : null;
}

/** The caller's access to the Space of the request (req.spaceAccess). */
export interface SpaceAccess {
  spaceId: string;
  /** What the caller may do: their member role, or VIEWER in a PUBLIC Space. */
  role: SpaceRole;
  /** The caller's SpaceMember role; null when they are not a member. */
  memberRole: SpaceRole | null;
  visibility: Visibility;
  archived: boolean;
}

export interface SpaceAccessRecord {
  id: string;
  visibility: Visibility;
  archivedAt: Date | null;
  memberRole: SpaceRole | null;
}

export type FindSpaceAccess = (
  spaceId: string,
  userId: string | undefined,
) => Promise<SpaceAccessRecord | null>;

const spaceIdSchema = z.uuid();

/**
 * requireSpaceRole(minRole): the caller needs at least minRole in the Space of the URL.
 * - 404 SPACE_NOT_FOUND: the Space does not exist (or the id is malformed);
 * - 401 UNAUTHENTICATED: no session and the Space is not PUBLIC;
 * - 403 FORBIDDEN: not a member of a non-PUBLIC Space, or a role below minRole.
 * Run it after authenticate or optionalAuth.
 */
export function createRequireSpaceRole(findSpaceAccess: FindSpaceAccess) {
  return function requireSpaceRole(minRole: SpaceRole, paramName = 'spaceId'): RequestHandler {
    return async (req, _res, next) => {
      const spaceId = spaceIdSchema.safeParse(req.params[paramName]);
      const record = spaceId.success ? await findSpaceAccess(spaceId.data, req.auth?.userId) : null;
      if (record === null) throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404);

      const role = effectiveSpaceRole(record.visibility, record.memberRole);
      if (role === null && req.auth === undefined) {
        throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
      }
      if (role === null) {
        throw new AppError('FORBIDDEN', 'You are not a member of this Space', 403);
      }
      if (!hasSpaceRole(role, minRole)) {
        throw new AppError('FORBIDDEN', `This needs the ${minRole} role in the Space`, 403);
      }

      req.spaceAccess = {
        spaceId: record.id,
        role,
        memberRole: record.memberRole,
        visibility: record.visibility,
        archived: record.archivedAt !== null,
      };
      next();
    };
  };
}

export type RequireSpaceRole = ReturnType<typeof createRequireSpaceRole>;

/** The Space access of a request that went through requireSpaceRole. */
export function requireSpaceAccess(req: Request): SpaceAccess {
  if (req.spaceAccess === undefined) throw new Error('requireSpaceRole() must run first');
  return req.spaceAccess;
}
