import { isUniqueConstraintError, type PrismaClient } from '../../lib/prisma';

export function createLikesRepository(prisma: PrismaClient) {
  return {
    /** Removes the user's like, or adds it when there was none. Returns whether it is liked now. */
    async toggle(postId: string, userId: string): Promise<boolean> {
      const { count } = await prisma.like.deleteMany({ where: { postId, userId } });
      if (count > 0) return false;
      try {
        await prisma.like.create({ data: { postId, userId } });
      } catch (error) {
        // A simultaneous like from the same user already exists: it is liked.
        if (!isUniqueConstraintError(error)) throw error;
      }
      return true;
    },

    countForPost(postId: string): Promise<number> {
      return prisma.like.count({ where: { postId } });
    },
  };
}

export type LikesRepository = ReturnType<typeof createLikesRepository>;
