import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';
import { visibleMomentsWhere, visiblePostsWhere } from '../social/social-visibility';

/**
 * The snaps a viewer may see: those of a Space the viewer can see (a member, or anyone in a
 * PUBLIC Space), and the others only through a Post or an active Moment the viewer may see.
 */
function visibleSnapsWhere(viewerId: string | undefined, now: Date): Prisma.SnapWhereInput {
  return {
    OR: [
      { space: { visibility: 'PUBLIC' } },
      ...(viewerId === undefined ? [] : [{ space: { members: { some: { userId: viewerId } } } }]),
      { postMedia: { some: { post: visiblePostsWhere(viewerId) } } },
      { moments: { some: visibleMomentsWhere(viewerId, now) } },
    ],
  };
}

export function createSnapVisibilityRepository(prisma: PrismaClient) {
  return {
    /** Which of the snaps the viewer may see, in one query. */
    async findVisibleIds(
      viewerId: string | undefined,
      snapIds: readonly string[],
      now: Date,
    ): Promise<string[]> {
      const snaps = await prisma.snap.findMany({
        where: { AND: [{ id: { in: [...snapIds] } }, visibleSnapsWhere(viewerId, now)] },
        select: { id: true },
      });
      return snaps.map(({ id }) => id);
    },
  };
}

export type SnapVisibilityRepository = ReturnType<typeof createSnapVisibilityRepository>;
