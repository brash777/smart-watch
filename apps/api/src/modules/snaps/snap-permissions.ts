import type { SpaceRole } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { effectiveSpaceRole, hasSpaceRole } from '../../middlewares/require-space-role';
import type { SpacesRepository } from '../spaces/spaces.repository';
import type { SnapRecord, SnapsRepository } from './snaps.repository';

export interface SnapPermissionsDependencies {
  snaps: SnapsRepository;
  spaces: SpacesRepository;
}

/** Who may see and change one snap, for the routes under /api/snaps/:id. */
export function createSnapPermissions({ snaps, spaces }: SnapPermissionsDependencies) {
  /** The snap and the caller's role in its Space, checked like requireSpaceRole('VIEWER'). */
  async function findSnapForUser(
    snapId: string,
    userId: string | undefined,
  ): Promise<{ snap: SnapRecord; memberRole: SpaceRole | null }> {
    const snap = await snaps.findById(snapId);
    if (snap === null) throw new AppError('SNAP_NOT_FOUND', 'Snap not found', 404);
    const access = await spaces.findAccess(snap.spaceId, userId);
    const role = access === null ? null : effectiveSpaceRole(access.visibility, access.memberRole);
    if (role === null && userId === undefined) {
      throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
    }
    if (role === null) throw new AppError('FORBIDDEN', 'You are not a member of this Space', 403);
    return { snap, memberRole: access?.memberRole ?? null };
  }

  /** Only the author (while EDITOR or OWNER) or an OWNER of the Space changes a snap. */
  function assertCanModify(snap: SnapRecord, userId: string, memberRole: SpaceRole | null): void {
    const isOwner = memberRole === 'OWNER';
    const isActiveAuthor =
      snap.authorId === userId && memberRole !== null && hasSpaceRole(memberRole, 'EDITOR');
    if (!isOwner && !isActiveAuthor) {
      throw new AppError(
        'FORBIDDEN',
        'Only the author or an OWNER of the Space can change this snap',
        403,
      );
    }
  }

  return { findSnapForUser, assertCanModify };
}

export type SnapPermissions = ReturnType<typeof createSnapPermissions>;
