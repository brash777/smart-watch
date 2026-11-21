import { authSessionSchema, type AuthSession, type UserRole } from '@snapia/shared';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { z } from 'zod';
import { hashPassword } from '../src/lib/password';
import type { PrismaClient } from '../src/lib/prisma';
import { createTestApp } from './test-app';
import { getTestPrisma } from './test-database';

/** Low bcrypt cost so tests stay fast (the cost is stored in each hash, so login still works). */
export const TEST_BCRYPT_ROUNDS = 4;
/** Password of every user created by createUser(). It follows the password policy. */
export const TEST_PASSWORD = 'test-password-1';

/** The real app on the test database, with a fast bcrypt cost. */
export function createDatabaseTestApp(overrides: Record<string, string | undefined> = {}): Express {
  return createTestApp(
    { BCRYPT_ROUNDS: String(TEST_BCRYPT_ROUNDS), ...overrides },
    { prisma: getTestPrisma() },
  ).app;
}

export interface TestUserOptions {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  bio?: string;
}

let sequence = 0;

/** Inserts a user straight into the database. */
export async function createUser(prisma: PrismaClient, options: TestUserOptions = {}) {
  sequence += 1;
  const username = options.username ?? `user_${sequence}`;
  return prisma.user.create({
    data: {
      name: options.name ?? `Test User ${sequence}`,
      username,
      email: options.email ?? `${username}@example.com`,
      passwordHash: await hashPassword(options.password ?? TEST_PASSWORD, TEST_BCRYPT_ROUNDS),
      role: options.role ?? 'USER',
      isActive: options.isActive ?? true,
      bio: options.bio ?? null,
    },
  });
}

const setCookieSchema = z.array(z.string()).catch([]);

/** The refresh_token Set-Cookie header of a response (with its attributes), if any. */
export function refreshSetCookie(response: Response): string | undefined {
  const headers = setCookieSchema.parse(response.headers['set-cookie']);
  return headers.find((header) => header.startsWith('refresh_token='));
}

/** The `refresh_token=<value>` pair to send back in a Cookie header. */
export function refreshCookie(response: Response): string {
  const header = refreshSetCookie(response);
  const pair = header?.split(';')[0];
  if (pair === undefined || pair === 'refresh_token=') {
    throw new Error('The response did not set a refresh cookie');
  }
  return pair;
}

const sessionResponseSchema = z.object({ data: authSessionSchema });

/** Reads the session of a register, login or refresh response. */
export function readSession(response: Response): AuthSession {
  return sessionResponseSchema.parse(response.body).data;
}

/** Signs a user in through the API. */
export async function signIn(
  app: Express,
  identifier: string,
  password: string = TEST_PASSWORD,
): Promise<{ accessToken: string; cookie: string; session: AuthSession }> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password })
    .expect(200);
  const session = readSession(response);
  return { accessToken: session.accessToken, cookie: refreshCookie(response), session };
}
