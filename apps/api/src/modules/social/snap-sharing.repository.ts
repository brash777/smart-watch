import type { PrismaClient } from '../../lib/prisma';

/** What sharing reads about a snap: its photo files, its Space and its insight. */
const snapToShareSelect = {
  id: true,
  authorId: true,
  spaceId: true,
  storageKey: true,
  thumbnailKey: true,
  width: true,
  height: true,
  takenAt: true,
  note: true,
  tags: true,
  analysisStatus: true,
  insight: { select: { mode: true, data: true } },
} as const;

export function createSnapSharingRepository(prisma: PrismaClient) {
  return {
    /** The snaps, with whether the user is still a member of each snap's Space. */
    async findSnapsToShare(snapIds: readonly string[], userId: string) {
      const snaps = await prisma.snap.findMany({
        where: { id: { in: [...snapIds] } },
        select: {
          ...snapToShareSelect,
          space: { select: { members: { where: { userId }, select: { role: true } } } },
        },
      });
      return snaps.map(({ space, ...snap }) => ({
        ...snap,
        authorIsMember: space.members.length > 0,
      }));
    },
  };
}

export type SnapSharingRepository = ReturnType<typeof createSnapSharingRepository>;
export type SnapToShare = Awaited<ReturnType<SnapSharingRepository['findSnapsToShare']>>[number];
