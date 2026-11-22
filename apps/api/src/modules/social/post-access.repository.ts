import type { PrismaClient } from '../../lib/prisma';
import { visiblePostsWhere } from './social-visibility';

export function createPostAccessRepository(prisma: PrismaClient) {
  return {
    /** A Post that is shown at all: not hidden by an ADMIN and from an active author. */
    findShown(postId: string) {
      return prisma.post.findFirst({
        where: { id: postId, hiddenAt: null, author: { isActive: true } },
        select: { id: true, authorId: true },
      });
    },

    async isVisible(postId: string, viewerId: string | undefined): Promise<boolean> {
      return (
        (await prisma.post.count({ where: { id: postId, ...visiblePostsWhere(viewerId) } })) > 0
      );
    },
  };
}

export type PostAccessRepository = ReturnType<typeof createPostAccessRepository>;
