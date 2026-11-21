import type { UserRole } from '@snapia/shared';
import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { readError } from '../../test/http';
import { createTestConfig } from '../../test/test-config';
import { createLogger } from '../lib/logger';
import { createAuthMiddlewares, requireAuth } from './authenticate';
import { createErrorHandler } from './error-handler';
import { requireRole } from './require-role';

interface FakeUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

/** Each fake token belongs to one fake user. */
const users: Record<string, FakeUser> = {
  'user-token': { id: 'u1', username: 'user', role: 'USER', isActive: true },
  'admin-token': { id: 'a1', username: 'admin', role: 'ADMIN', isActive: true },
  'inactive-token': { id: 'i1', username: 'inactive', role: 'USER', isActive: false },
};

function createAppWithAuth(): express.Express {
  const { authenticate, optionalAuth } = createAuthMiddlewares({
    verifyAccessToken: (token) => Promise.resolve(users[token]?.id ?? null),
    findUser: (id) => Promise.resolve(Object.values(users).find((user) => user.id === id) ?? null),
  });

  const app = express();
  app.use(pinoHttp({ logger: createLogger(createTestConfig()) }));
  app.get('/private', authenticate, (req, res) => {
    res.json({ data: requireAuth(req) });
  });
  app.get('/public', optionalAuth, (req, res) => {
    res.json({ data: { username: req.auth?.username ?? null } });
  });
  app.get('/admin', authenticate, requireRole('ADMIN'), (_req, res) => {
    res.json({ data: { ok: true } });
  });
  app.get('/role-without-authenticate', requireRole('ADMIN'), (_req, res) => {
    res.json({ data: { ok: true } });
  });
  app.use(createErrorHandler({ isProduction: true }));
  return app;
}

describe('authenticate', () => {
  const app = createAppWithAuth();

  it('sets req.auth from a valid Bearer token', async () => {
    const response = await request(app).get('/private').set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { userId: 'u1', username: 'user', role: 'USER' } });
  });

  it('answers 401 UNAUTHENTICATED without a token, with a bad token or a malformed header', async () => {
    const missing = await request(app).get('/private');
    const invalid = await request(app).get('/private').set('Authorization', 'Bearer nope');
    const malformed = await request(app).get('/private').set('Authorization', 'Token user-token');

    for (const response of [missing, invalid, malformed]) {
      expect(response.status).toBe(401);
      expect(readError(response.body).code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects the token of a deactivated user', async () => {
    const response = await request(app)
      .get('/private')
      .set('Authorization', 'Bearer inactive-token');

    expect(response.status).toBe(401);
  });
});

describe('optionalAuth', () => {
  const app = createAppWithAuth();

  it('lets anonymous requests through', async () => {
    const response = await request(app).get('/public');

    expect(response.body).toEqual({ data: { username: null } });
  });

  it('sets req.auth when there is a valid token', async () => {
    const response = await request(app).get('/public').set('Authorization', 'Bearer user-token');

    expect(response.body).toEqual({ data: { username: 'user' } });
  });

  it('still rejects an invalid token, so the client knows it must refresh', async () => {
    const response = await request(app).get('/public').set('Authorization', 'Bearer expired');

    expect(response.status).toBe(401);
  });
});

describe('requireRole', () => {
  const app = createAppWithAuth();

  it('answers 403 FORBIDDEN when the role is not allowed', async () => {
    const response = await request(app).get('/admin').set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(403);
    expect(readError(response.body).code).toBe('FORBIDDEN');
  });

  it('lets allowed roles through', async () => {
    await request(app).get('/admin').set('Authorization', 'Bearer admin-token').expect(200);
  });

  it('answers 401 when no authenticated user reached it', async () => {
    const response = await request(app).get('/role-without-authenticate');

    expect(response.status).toBe(401);
  });
});
