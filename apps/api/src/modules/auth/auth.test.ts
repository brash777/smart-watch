import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createDatabaseTestApp,
  createUser,
  readSession,
  refreshCookie,
  refreshSetCookie,
  signIn,
  TEST_PASSWORD,
} from '../../../test/factories';
import { readError } from '../../../test/http';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { hashToken } from './auth.tokens';

const prisma = getTestPrisma();

const newAccount = {
  name: 'Ana Test',
  username: 'Ana.Test',
  email: 'Ana.Test@Example.com',
  password: 'secret-pass-1',
};

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

describe('POST /api/auth/register', () => {
  it('creates a USER account, signs it in and sets the refresh cookie', async () => {
    const app = createDatabaseTestApp();

    const response = await request(app).post('/api/auth/register').send(newAccount);

    expect(response.status).toBe(201);
    const session = readSession(response);
    expect(session.tokenType).toBe('Bearer');
    expect(session.accessToken.length).toBeGreaterThan(0);
    expect(session.user).toMatchObject({
      name: 'Ana Test',
      username: 'ana.test',
      email: 'ana.test@example.com',
      role: 'USER',
    });

    const cookie = refreshSetCookie(response) ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('stores a bcrypt hash of the password and only the hash of the refresh token', async () => {
    const app = createDatabaseTestApp();

    const response = await request(app).post('/api/auth/register').send(newAccount).expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'ana.test' } });
    expect(user.passwordHash).not.toContain(newAccount.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);

    const token = refreshCookie(response).slice('refresh_token='.length);
    const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(hashToken(token));
    expect(stored[0]?.tokenHash).not.toBe(token);
  });

  it('rejects a taken email or username with 409', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'taken.name', email: 'taken@example.com' });

    const sameEmail = await request(app)
      .post('/api/auth/register')
      .send({ ...newAccount, email: 'TAKEN@example.com' });
    const sameUsername = await request(app)
      .post('/api/auth/register')
      .send({ ...newAccount, username: 'Taken.Name' });

    expect(sameEmail.status).toBe(409);
    expect(readError(sameEmail.body).code).toBe('EMAIL_TAKEN');
    expect(sameUsername.status).toBe(409);
    expect(readError(sameUsername.body).code).toBe('USERNAME_TAKEN');
  });

  it('applies the password policy and the username format', async () => {
    const app = createDatabaseTestApp();

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...newAccount, username: 'no spaces!', password: 'short' });

    expect(response.status).toBe(400);
    const error = readError(response.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    const paths = (error.details as { path: string }[]).map(({ path }) => path);
    expect(paths).toEqual(expect.arrayContaining(['body.username', 'body.password']));
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with the email or with the username', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo', email: 'leo@example.com' });

    const byEmail = await signIn(app, 'LEO@example.com');
    const byUsername = await signIn(app, 'leo');

    expect(byEmail.session.user.username).toBe('leo');
    expect(byUsername.session.user.email).toBe('leo@example.com');
  });

  it('answers a wrong password and an unknown account with the same 401', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'leo', password: 'not-the-password-1' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody', password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(readError(wrongPassword.body)).toEqual(readError(unknownUser.body));
    expect(readError(wrongPassword.body).code).toBe('INVALID_CREDENTIALS');
  });

  it('does not let a deactivated account sign in', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'gone', isActive: false });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'gone', password: TEST_PASSWORD });

    expect(response.status).toBe(403);
    expect(readError(response.body).code).toBe('ACCOUNT_DISABLED');
  });

  it('limits login and register attempts with AUTH_RATE_LIMIT_MAX', async () => {
    const app = createDatabaseTestApp({ AUTH_RATE_LIMIT_MAX: '2' });
    const attempt = () =>
      request(app).post('/api/auth/login').send({ identifier: 'nobody', password: 'x' });

    await attempt().expect(401);
    await attempt().expect(401);
    const limited = await attempt();
    const register = await request(app).post('/api/auth/register').send(newAccount);

    expect(limited.status).toBe(429);
    expect(readError(limited.body).code).toBe('RATE_LIMITED');
    expect(register.status).toBe(429);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token: revokes the one used and issues a new session', async () => {
    const app = createDatabaseTestApp();
    const user = await createUser(prisma, { username: 'leo' });
    const { cookie } = await signIn(app, 'leo');

    const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(readSession(response).user.id).toBe(user.id);
    const newCookie = refreshCookie(response);
    expect(newCookie).not.toBe(cookie);

    const tokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.revokedAt).not.toBeNull();
    expect(tokens[1]?.revokedAt).toBeNull();
  });

  it('answers 401 when a revoked refresh token is reused, and ends every session of the user', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    const { cookie: firstCookie } = await signIn(app, 'leo');
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    const secondCookie = refreshCookie(rotated);

    const reused = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    const afterTheft = await request(app).post('/api/auth/refresh').set('Cookie', secondCookie);

    expect(reused.status).toBe(401);
    expect(readError(reused.body).code).toBe('INVALID_REFRESH_TOKEN');
    expect(refreshSetCookie(reused)).toMatch(/refresh_token=;/);
    expect(afterTheft.status).toBe(401);
  });

  it('answers 401 without a cookie or with a forged token', async () => {
    const app = createDatabaseTestApp();

    const missing = await request(app).post('/api/auth/refresh');
    const forged = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-real-token');

    expect(missing.status).toBe(401);
    expect(forged.status).toBe(401);
  });

  it('answers 401 once the account is deactivated', async () => {
    const app = createDatabaseTestApp();
    const user = await createUser(prisma, { username: 'leo' });
    const { cookie } = await signIn(app, 'leo');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(response.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user with the email but never the password hash', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo', email: 'leo@example.com' });
    const { accessToken } = await signIn(app, 'leo');

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { username: 'leo', email: 'leo@example.com' } });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('answers 401 without a token or with an invalid one', async () => {
    const app = createDatabaseTestApp();

    const missing = await request(app).get('/api/auth/me');
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc');

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it('stops accepting a still-valid access token once the account is deactivated', async () => {
    const app = createDatabaseTestApp();
    const user = await createUser(prisma, { username: 'leo' });
    const { accessToken } = await signIn(app, 'leo');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    const { cookie } = await signIn(app, 'leo');

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect(refreshSetCookie(logout)).toMatch(/refresh_token=;/);
    expect(refresh.status).toBe(401);
  });

  it('succeeds without a session', async () => {
    const app = createDatabaseTestApp();

    await request(app).post('/api/auth/logout').expect(204);
  });
});
