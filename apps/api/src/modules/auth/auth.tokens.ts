import { createHash, randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { Config } from '../../config/env';

const ALGORITHM = 'HS256';

export interface IssuedRefreshToken {
  /** The token sent to the browser in the httpOnly cookie. Never stored. */
  token: string;
  /** What the database stores instead of the token. */
  tokenHash: string;
  expiresAt: Date;
}

/** SHA-256 of a token: the database only keeps this hash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function secondsSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Verifies a JWT and returns its subject (the user id), or null if it is invalid or expired. */
async function verifySubject(token: string, key: Uint8Array): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

/**
 * Signs and verifies the two tokens of a session. Secrets and lifetimes come from
 * JWT_ACCESS_SECRET / JWT_ACCESS_TTL and JWT_REFRESH_SECRET / JWT_REFRESH_TTL.
 */
export function createTokenService(auth: Config['auth']) {
  const encoder = new TextEncoder();
  const accessKey = encoder.encode(auth.jwtAccessSecret);
  const refreshKey = encoder.encode(auth.jwtRefreshSecret);

  return {
    accessTokenTtlSeconds: auth.accessTokenTtlSeconds,

    signAccessToken(userId: string): Promise<string> {
      const expiresAt = new Date(Date.now() + auth.accessTokenTtlSeconds * 1000);
      return new SignJWT({})
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(secondsSinceEpoch(expiresAt))
        .sign(accessKey);
    },

    verifyAccessToken(token: string): Promise<string | null> {
      return verifySubject(token, accessKey);
    },

    async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
      const expiresAt = new Date(Date.now() + auth.refreshTokenTtlSeconds * 1000);
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime(secondsSinceEpoch(expiresAt))
        .sign(refreshKey);
      return { token, tokenHash: hashToken(token), expiresAt };
    },

    /** Returns the user id and the hash of a refresh token with a valid signature, or null. */
    async verifyRefreshToken(token: string): Promise<{ userId: string; tokenHash: string } | null> {
      const userId = await verifySubject(token, refreshKey);
      return userId === null ? null : { userId, tokenHash: hashToken(token) };
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
