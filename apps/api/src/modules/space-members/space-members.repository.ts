import type { SpaceRole } from '@snapia/shared';
import type { Prisma } from '../../generated/prisma/client';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { userSummarySelect, type UserPageQuery } from '../users/users.repository';

const memberSelect = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: userSummarySelect },
} as const;

/** Membership queries, bound to a client or to a transaction. */
function membershipQueries(db: Prisma.TransactionClient) {
  return {
    findMember(spaceId: string, userId: string) {
      return db.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: memberSelect,
      });
    },

    countOwners(spaceId: string) {
      return db.spaceMember.count({ where: { spaceId, role: 'OWNER' } });
    },

    findSpace(spaceId: string) {
      return db.space.findUnique({
        where: { id: spaceId },
        select: { id: true, ownerId: true, visibility: true },
      });
    },

    /** The OWNER who joined first, apart from excludedUserId. */
    findOldestOtherOwner(spaceId: string, excludedUserId: string) {
      return db.spaceMember.findFirst({
        where: { spaceId, role: 'OWNER', userId: { not: excludedUserId } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: { userId: true },
      });
    },

    setRole(spaceId: string, userId: string, role: SpaceRole) {
      return db.spaceMember.update({
        where: { spaceId_userId: { spaceId, userId } },
        data: { role },
        select: memberSelect,
      });
    },

    async removeMember(spaceId: string, userId: string): Promise<void> {
      await db.spaceMember.delete({ where: { spaceId_userId: { spaceId, userId } } });
    },

    async setSpaceOwner(spaceId: string, ownerId: string): Promise<void> {
      await db.space.update({ where: { id: spaceId }, data: { ownerId } });
    },
  };
}

export type MembershipQueries = ReturnType<typeof membershipQueries>;
export type MemberRecord = NonNullable<Awaited<ReturnType<MembershipQueries['findMember']>>>;

export function createSpaceMembersRepository(prisma: PrismaClient) {
  return {
    /** Active members, OWNERs first, then by join date. */
    list(spaceId: string, page: UserPageQuery) {
      return prisma.spaceMember.findMany({
        where: { spaceId, user: { isActive: true } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
        select: memberSelect,
        ...pageArgs(page),
      });
    },

    /**
     * Runs fn inside one transaction that locks the Space row, so the membership changes of a
     * Space happen one at a time (two OWNERs leaving at once cannot leave it without OWNERs).
     */
    withSpaceLock<T>(spaceId: string, fn: (queries: MembershipQueries) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM spaces WHERE id = ${spaceId}::uuid FOR UPDATE`;
        return fn(membershipQueries(tx));
      });
    },
  };
}

export type SpaceMembersRepository = ReturnType<typeof createSpaceMembersRepository>;
