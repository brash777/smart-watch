import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { userSummarySelect } from '../users/users.repository';

const commentSelect = {
  id: true,
  postId: true,
  userId: true,
  body: true,
  createdAt: true,
  user: { select: userSummarySelect },
} as const;

export function createCommentsRepository(prisma: PrismaClient) {
  return {
    create(comment: { postId: string; userId: string; body: string }) {
      return prisma.comment.create({ data: comment, select: commentSelect });
    },

    /** The shown comments of a Post, the oldest first. */
    listForPost(postId: string, page: { cursor?: string | undefined; limit: number }) {
      return prisma.comment.findMany({
        where: { postId, hiddenAt: null, user: { isActive: true } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: commentSelect,
        ...pageArgs(page),
      });
    },

    findWithPostAuthor(id: string) {
      return prisma.comment.findUnique({
        where: { id },
        select: { id: true, userId: true, post: { select: { authorId: true } } },
      });
    },

    async delete(id: string): Promise<void> {
      await prisma.comment.delete({ where: { id } });
    },
  };
}

export type CommentsRepository = ReturnType<typeof createCommentsRepository>;
export type CommentRecord = Awaited<ReturnType<CommentsRepository['create']>>;
