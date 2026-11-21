import type { UserRole } from '@snapia/shared';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { meUserSelect } from '../auth/auth.repository';

/** Fields every public view of a user may show. Never the email, the password hash or the role. */
export const userSummarySelect = {
  id: true,
  name: true,
  username: true,
  avatarKey: true,
} as const;

const adminUserSelect = {
  ...userSummarySelect,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export interface UserPageQuery {
  cursor?: string | undefined;
  limit: number;
}

export interface AdminUserFilters extends UserPageQuery {
  q?: string | undefined;
  role?: UserRole | undefined;
  isActive?: boolean | undefined;
}

/** Case-insensitive "contains" on the given text fields. */
function textSearch(q: string, fields: readonly ('username' | 'name' | 'email')[]) {
  return fields.map((field) => ({ [field]: { contains: q, mode: 'insensitive' as const } }));
}

export function createUsersRepository(prisma: PrismaClient) {
  return {
    /** Public profile with its counts. Deactivated users have no public profile. */
    findActiveProfile(username: string) {
      return prisma.user.findFirst({
        where: { username, isActive: true },
        select: {
          ...userSummarySelect,
          bio: true,
          _count: {
            select: {
              posts: { where: { hiddenAt: null } },
              followers: { where: { follower: { isActive: true } } },
              following: { where: { following: { isActive: true } } },
            },
          },
        },
      });
    },

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
        select: { id: true },
      });
      return follow !== null;
    },

    updateMe(
      id: string,
      data: { name?: string | undefined; bio?: string | null; university?: string | null },
    ) {
      return prisma.user.update({ where: { id }, data, select: meUserSelect });
    },

    /** Active users whose username or name contains q, by username. */
    searchActive(q: string, page: UserPageQuery) {
      return prisma.user.findMany({
        where: { isActive: true, OR: textSearch(q, ['username', 'name']) },
        orderBy: [{ username: 'asc' }, { id: 'asc' }],
        select: userSummarySelect,
        ...pageArgs(page),
      });
    },

    /** Every user, newest first, filtered for the admin panel. */
    listForAdmin({ q, role, isActive, ...page }: AdminUserFilters) {
      return prisma.user.findMany({
        where: {
          ...(role === undefined ? {} : { role }),
          ...(isActive === undefined ? {} : { isActive }),
          ...(q === undefined ? {} : { OR: textSearch(q, ['username', 'name', 'email']) }),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: adminUserSelect,
        ...pageArgs(page),
      });
    },

    findForAdmin(id: string) {
      return prisma.user.findUnique({ where: { id }, select: adminUserSelect });
    },

    setRole(id: string, role: UserRole) {
      return prisma.user.update({ where: { id }, data: { role }, select: adminUserSelect });
    },

    /** Activates or deactivates an account. Deactivating it also ends all of its sessions. */
    async setActive(id: string, isActive: boolean) {
      const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { isActive }, select: adminUserSelect }),
        ...(isActive
          ? []
          : [
              prisma.refreshToken.updateMany({
                where: { userId: id, revokedAt: null },
                data: { revokedAt: new Date() },
              }),
            ]),
      ]);
      return user;
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
