import { AppError } from '../../lib/app-error';
import type { SnapSharingRepository, SnapToShare } from './snap-sharing.repository';

/**
 * Only the author of a snap shares it as a Moment or a Post (docs/PRODUCT.md, "Snaps outside
 * their Space"), and only while still a member of its Space.
 */
export function createSnapSharing(repository: SnapSharingRepository) {
  return {
    /** The snaps in the order of snapIds, once every check passed. */
    async snapsToShare(userId: string, snapIds: readonly string[]): Promise<SnapToShare[]> {
      const snaps = await repository.findSnapsToShare(snapIds, userId);
      const byId = new Map(snaps.map((snap) => [snap.id, snap]));
      const missing = snapIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new AppError('SNAP_NOT_FOUND', 'Snap not found', 404, { snapIds: missing });
      }
      const notShareable = snaps.filter((snap) => snap.authorId !== userId || !snap.authorIsMember);
      if (notShareable.length > 0) {
        throw new AppError(
          'NOT_SNAP_AUTHOR',
          'Only the author of a snap, while a member of its Space, can share it',
          403,
          { snapIds: notShareable.map(({ id }) => id) },
        );
      }
      return snapIds.map((id) => byId.get(id)).filter((snap) => snap !== undefined);
    },
  };
}

export type SnapSharing = ReturnType<typeof createSnapSharing>;
