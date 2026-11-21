import type { PrismaClient } from '../../lib/prisma';

/** Fields of the signed-in user (GET /auth/me). Never the password hash. */
const meUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  bio: true,
  university: true,
  createdAt: true,
  isActive: true,
} as const;

export function createAuthRepository(prisma: PrismaClient) {
  return {
    findUserById(id: string) {
      return prisma.user.findUnique({ where: { id }, select: meUserSelect });
    },

    /** What authenticate needs on every request: the current role and whether the account is active. */
    findSessionUser(id: string) {
      return prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, role: true, isActive: true },
      });
    },

    /** Login lookup: identifier is a (lowercase) email or username. Includes the password hash. */
    findUserForLogin(identifier: string) {
      return prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
        select: { ...meUserSelect, passwordHash: true },
      });
    },

    findUserWithEmailOrUsername(email: string, username: string) {
      return prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
        select: { email: true, username: true },
      });
    },

    createUser(data: { name: string; username: string; email: string; passwordHash: string }) {
      return prisma.user.create({ data: { ...data, role: 'USER' }, select: meUserSelect });
    },

    saveRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
      return prisma.refreshToken.create({ data, select: { id: true } });
    },

    findRefreshToken(tokenHash: string) {
      return prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, revokedAt: true },
      });
    },

    /** Revokes one token if it is still active. False when it was already revoked (concurrent use). */
    async revokeRefreshToken(id: string, now: Date): Promise<boolean> {
      const { count } = await prisma.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: now },
      });
      return count > 0;
    },

    /** Revokes every active refresh token of a user: ends all their sessions. */
    async revokeAllRefreshTokens(userId: string, now: Date): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
export type MeUserRecord = NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>;
