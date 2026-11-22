import { randomUUID } from 'node:crypto';
import type { AuthSession, LoginBody, MeUser, RegisterBody } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { hashPassword, verifyPassword } from '../../lib/password';
import { isUniqueConstraintError } from '../../lib/prisma';
import type { AvatarUrlResolver } from '../users/avatars';
import type { AuthRepository, MeUserRecord } from './auth.repository';
import type { IssuedRefreshToken, TokenService } from './auth.tokens';

/** A new session: the JSON body for the client and the refresh token for the cookie. */
export interface AuthResult {
  session: AuthSession;
  refreshToken: IssuedRefreshToken;
}

export interface AuthServiceDependencies {
  repository: AuthRepository;
  tokens: TokenService;
  bcryptRounds: number;
  avatarUrl: AvatarUrlResolver;
}

const invalidRefreshToken = () =>
  new AppError('INVALID_REFRESH_TOKEN', 'The session expired, sign in again', 401);

/** The signed-in user, with a signed URL of their square profile photo (or null). */
export async function toMeUser(user: MeUserRecord, avatarUrl: AvatarUrlResolver): Promise<MeUser> {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    bio: user.bio,
    university: user.university,
    avatarUrl: await avatarUrl(user.avatarKey),
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService({
  repository,
  tokens,
  bcryptRounds,
  avatarUrl,
}: AuthServiceDependencies) {
  let dummyPasswordHash: Promise<string> | undefined;

  /** Compares against a throwaway hash so unknown accounts take as long as wrong passwords. */
  async function spendPasswordCheckTime(password: string): Promise<void> {
    dummyPasswordHash ??= hashPassword(randomUUID(), bcryptRounds);
    await verifyPassword(password, await dummyPasswordHash);
  }

  async function startSession(user: MeUserRecord): Promise<AuthResult> {
    const refreshToken = await tokens.issueRefreshToken(user.id);
    await repository.saveRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
    });
    return {
      session: {
        accessToken: await tokens.signAccessToken(user.id),
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenTtlSeconds,
        user: await toMeUser(user, avatarUrl),
      },
      refreshToken,
    };
  }

  async function throwIfTaken(email: string, username: string): Promise<void> {
    const existing = await repository.findUserWithEmailOrUsername(email, username);
    if (existing === null) return;
    if (existing.email === email) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409);
    }
    throw new AppError('USERNAME_TAKEN', 'This username is already taken', 409);
  }

  return {
    /** Creates a USER account and signs it in. */
    async register(input: RegisterBody): Promise<AuthResult> {
      await throwIfTaken(input.email, input.username);
      const passwordHash = await hashPassword(input.password, bcryptRounds);
      try {
        const user = await repository.createUser({
          name: input.name,
          username: input.username,
          email: input.email,
          passwordHash,
        });
        return await startSession(user);
      } catch (error) {
        // Another registration took the email or username between the check and the insert.
        if (isUniqueConstraintError(error)) await throwIfTaken(input.email, input.username);
        throw error;
      }
    },

    /** Signs in with an email or a username. Deactivated accounts cannot sign in. */
    async login({ identifier, password }: LoginBody): Promise<AuthResult> {
      const user = await repository.findUserForLogin(identifier);
      if (user === null) {
        await spendPasswordCheckTime(password);
        throw new AppError('INVALID_CREDENTIALS', 'Wrong email, username or password', 401);
      }
      if (!(await verifyPassword(password, user.passwordHash))) {
        throw new AppError('INVALID_CREDENTIALS', 'Wrong email, username or password', 401);
      }
      if (!user.isActive) {
        throw new AppError('ACCOUNT_DISABLED', 'This account has been deactivated', 403);
      }
      return startSession(user);
    },

    /**
     * Rotates the refresh token: revokes the one used and issues a new session.
     * Reusing a revoked token means it may have been stolen, so every session of that user ends.
     */
    async refresh(refreshToken: string | undefined): Promise<AuthResult> {
      if (refreshToken === undefined) throw invalidRefreshToken();
      const verified = await tokens.verifyRefreshToken(refreshToken);
      if (verified === null) throw invalidRefreshToken();

      const stored = await repository.findRefreshToken(verified.tokenHash);
      if (stored === null || stored.userId !== verified.userId) throw invalidRefreshToken();

      const now = new Date();
      if (stored.revokedAt !== null || !(await repository.revokeRefreshToken(stored.id, now))) {
        await repository.revokeAllRefreshTokens(stored.userId, now);
        throw invalidRefreshToken();
      }
      if (stored.expiresAt <= now) throw invalidRefreshToken();

      const user = await repository.findUserById(stored.userId);
      if (user === null || !user.isActive) throw invalidRefreshToken();
      return startSession(user);
    },

    /** The signed-in user, with the private fields only its owner sees. */
    async getMe(userId: string): Promise<MeUser> {
      const user = await repository.findUserById(userId);
      if (user === null) throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
      return toMeUser(user, avatarUrl);
    },

    /** Revokes the refresh token of this session, if any. Always succeeds. */
    async logout(refreshToken: string | undefined): Promise<void> {
      if (refreshToken === undefined) return;
      const verified = await tokens.verifyRefreshToken(refreshToken);
      if (verified === null) return;
      const stored = await repository.findRefreshToken(verified.tokenHash);
      if (stored !== null) await repository.revokeRefreshToken(stored.id, new Date());
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
