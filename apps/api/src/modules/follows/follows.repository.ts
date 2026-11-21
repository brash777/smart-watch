import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { userSummarySelect, type UserPageQuery } from '../users/users.repository';

/** Newest follows first; the follow id is the page cursor. */
const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export function createFollowsRepository(prisma: PrismaClient) {
  return {
    findActiveUserId(username: string) {
      return prisma.user.findFirst({ where: { username, isActive: true }, select: { id: true } });
    },

    /** Idempotent: following twice keeps a single Follow. */
    async follow(followerId: string, followingId: string): Promise<void> {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId, followingId } },
        create: { followerId, followingId },
        update: {},
      });
    },

    /** Idempotent: unfollowing someone you do not follow does nothing. */
    async unfollow(followerId: string, followingId: string): Promise<void> {
      await prisma.follow.deleteMany({ where: { followerId, followingId } });
    },

    countFollowers(userId: string) {
      return prisma.follow.count({ where: { followingId: userId, follower: { isActive: true } } });
    },

    /** Active users who follow userId. */
    listFollowers(userId: string, page: UserPageQuery) {
      return prisma.follow.findMany({
        where: { followingId: userId, follower: { isActive: true } },
        orderBy: newestFirst,
        select: { id: true, follower: { select: userSummarySelect } },
        ...pageArgs(page),
      });
    },

    /** Active users that userId follows. */
    listFollowing(userId: string, page: UserPageQuery) {
      return prisma.follow.findMany({
        where: { followerId: userId, following: { isActive: true } },
        orderBy: newestFirst,
        select: { id: true, following: { select: userSummarySelect } },
        ...pageArgs(page),
      });
    },
  };
}

export type FollowsRepository = ReturnType<typeof createFollowsRepository>;
