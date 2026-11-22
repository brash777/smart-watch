import type { SpaceRole } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { effectiveSpaceRole, hasSpaceRole } from '../../middlewares/require-space-role';
import type { SpacesRepository } from './spaces.repository';

/**
 * Who may see and change one piece of content of a Space (a snap, a Document…) when the route
 * names the content, not the Space.
 */
export function createSpaceContentPermissions(spaces: SpacesRepository) {
  /**
   * The caller's SpaceMember role (null when they only see a PUBLIC Space), checked like
   * requireSpaceRole('VIEWER'): 401 without a session, 403 without access.
   */
  async function memberRoleIn(
    spaceId: string,
    userId: string | undefined,
  ): Promise<SpaceRole | null> {
    const access = await spaces.findAccess(spaceId, userId);
    const role = access === null ? null : effectiveSpaceRole(access.visibility, access.memberRole);
    if (role === null && userId === undefined) {
      throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
    }
    if (role === null) throw new AppError('FORBIDDEN', 'You are not a member of this Space', 403);
    return access?.memberRole ?? null;
  }

  /** Only its author (while EDITOR or OWNER) or an OWNER of the Space changes the content. */
  function assertCanModify(authorId: string, userId: string, memberRole: SpaceRole | null): void {
    const isOwner = memberRole === 'OWNER';
    const isActiveAuthor =
      authorId === userId && memberRole !== null && hasSpaceRole(memberRole, 'EDITOR');
    if (!isOwner && !isActiveAuthor) {
      throw new AppError(
        'FORBIDDEN',
        'Only the author or an OWNER of the Space can change this',
        403,
      );
    }
  }

  return { memberRoleIn, assertCanModify };
}

export type SpaceContentPermissions = ReturnType<typeof createSpaceContentPermissions>;
