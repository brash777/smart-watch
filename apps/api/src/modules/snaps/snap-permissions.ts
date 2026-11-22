import type { SpaceRole } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { createSpaceContentPermissions } from '../spaces/space-content-permissions';
import type { SpacesRepository } from '../spaces/spaces.repository';
import type { SnapRecord, SnapsRepository } from './snaps.repository';

export interface SnapPermissionsDependencies {
  snaps: SnapsRepository;
  spaces: SpacesRepository;
}

/** Who may see and change one snap, for the routes under /api/snaps/:id. */
export function createSnapPermissions({ snaps, spaces }: SnapPermissionsDependencies) {
  const content = createSpaceContentPermissions(spaces);

  /** The snap and the caller's role in its Space, checked like requireSpaceRole('VIEWER'). */
  async function findSnapForUser(
    snapId: string,
    userId: string | undefined,
  ): Promise<{ snap: SnapRecord; memberRole: SpaceRole | null }> {
    const snap = await snaps.findById(snapId);
    if (snap === null) throw new AppError('SNAP_NOT_FOUND', 'Snap not found', 404);
    return { snap, memberRole: await content.memberRoleIn(snap.spaceId, userId) };
  }

  /** Only the author (while EDITOR or OWNER) or an OWNER of the Space changes a snap. */
  function assertCanModify(snap: SnapRecord, userId: string, memberRole: SpaceRole | null): void {
    content.assertCanModify(snap.authorId, userId, memberRole);
  }

  return { findSnapForUser, assertCanModify };
}

export type SnapPermissions = ReturnType<typeof createSnapPermissions>;
