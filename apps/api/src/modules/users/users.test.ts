import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDatabaseTestApp, createUser, signIn, TEST_PASSWORD } from '../../../test/factories';
import { readError } from '../../../test/http';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';

const prisma = getTestPrisma();

const pageSchema = z.object({
  data: z.array(z.object({ username: z.string() }).loose()),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

describe('GET /api/users/:username', () => {
  it('returns the public profile with its counts and without private fields', async () => {
    const app = createDatabaseTestApp();
    const leo = await createUser(prisma, { username: 'leo', bio: 'Técnico' });
    const ana = await createUser(prisma, { username: 'ana' });
    const sol = await createUser(prisma, { username: 'sol' });
    await prisma.follow.createMany({
      data: [
        { followerId: ana.id, followingId: leo.id },
        { followerId: sol.id, followingId: leo.id },
        { followerId: leo.id, followingId: ana.id },
      ],
    });
    await prisma.post.createMany({
      data: [
        { authorId: leo.id, caption: 'visible' },
        { authorId: leo.id, caption: 'hidden by a moderator', hiddenAt: new Date() },
      ],
    });

    const response = await request(app).get('/api/users/leo');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: leo.id,
        name: leo.name,
        username: 'leo',
        avatarUrl: null,
        bio: 'Técnico',
        counts: { posts: 1, followers: 2, following: 1 },
        isFollowedByMe: false,
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/email|passwordHash|role|@example\.com/);
  });

  it('tells whether the signed-in viewer follows the user', async () => {
    const app = createDatabaseTestApp();
    const leo = await createUser(prisma, { username: 'leo' });
    const ana = await createUser(prisma, { username: 'ana' });
    await prisma.follow.create({ data: { followerId: ana.id, followingId: leo.id } });
    await createUser(prisma, { username: 'sol' });
    const anaSession = await signIn(app, 'ana');
    const solSession = await signIn(app, 'sol');
    const leoSession = await signIn(app, 'leo');

    const byFollower = await request(app).get('/api/users/leo').set(bearer(anaSession.accessToken));
    const byOther = await request(app).get('/api/users/leo').set(bearer(solSession.accessToken));
    const ownProfile = await request(app).get('/api/users/leo').set(bearer(leoSession.accessToken));

    expect(byFollower.body).toMatchObject({ data: { isFollowedByMe: true } });
    expect(byOther.body).toMatchObject({ data: { isFollowedByMe: false } });
    expect(ownProfile.body).toMatchObject({ data: { isFollowedByMe: false } });
  });

  it('finds usernames case-insensitively and hides unknown and deactivated users', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    await createUser(prisma, { username: 'gone', isActive: false });

    await request(app).get('/api/users/LEO').expect(200);
    const unknown = await request(app).get('/api/users/nobody');
    const deactivated = await request(app).get('/api/users/gone');

    expect(unknown.status).toBe(404);
    expect(readError(unknown.body).code).toBe('USER_NOT_FOUND');
    expect(deactivated.status).toBe(404);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the name, the bio and the university of the signed-in user', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo', bio: 'old bio' });
    const { accessToken } = await signIn(app, 'leo');

    const response = await request(app)
      .patch('/api/users/me')
      .set(bearer(accessToken))
      .send({ name: '  Leo Nuevo ', bio: '', university: 'Universidad Demo' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: { username: 'leo', name: 'Leo Nuevo', bio: null, university: 'Universidad Demo' },
    });
  });

  it('needs a session and at least one field', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    const { accessToken } = await signIn(app, 'leo');

    const anonymous = await request(app).patch('/api/users/me').send({ name: 'X' });
    const empty = await request(app).patch('/api/users/me').set(bearer(accessToken)).send({});

    expect(anonymous.status).toBe(401);
    expect(empty.status).toBe(400);
  });
});

describe('GET /api/users/search', () => {
  it('matches the username or the name, ignoring case and deactivated users', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'ana.perez', name: 'Ana Pérez' });
    await createUser(prisma, { username: 'leo', name: 'Leonardo ANA Ruiz' });
    await createUser(prisma, { username: 'ana.gone', isActive: false });
    await createUser(prisma, { username: 'sol', name: 'Sol' });

    const response = await request(app).get('/api/users/search').query({ q: 'ANA' });

    expect(response.status).toBe(200);
    const { data } = pageSchema.parse(response.body);
    expect(data.map(({ username }) => username)).toEqual(['ana.perez', 'leo']);
    expect(JSON.stringify(response.body)).not.toMatch(/email/);
  });

  it('paginates with limit and cursor', async () => {
    const app = createDatabaseTestApp();
    for (const username of ['user_a', 'user_b', 'user_c']) await createUser(prisma, { username });

    const first = pageSchema.parse(
      (await request(app).get('/api/users/search').query({ q: 'user_', limit: 2 })).body,
    );
    const second = pageSchema.parse(
      (
        await request(app)
          .get('/api/users/search')
          .query({ q: 'user_', limit: 2, cursor: first.meta.nextCursor })
      ).body,
    );

    expect(first.data.map(({ username }) => username)).toEqual(['user_a', 'user_b']);
    expect(first.meta.nextCursor).not.toBeNull();
    expect(second.data.map(({ username }) => username)).toEqual(['user_c']);
    expect(second.meta.nextCursor).toBeNull();
  });

  it('requires q and rejects a limit above PAGINATION_MAX_LIMIT', async () => {
    const app = createDatabaseTestApp({ PAGINATION_DEFAULT_LIMIT: '2', PAGINATION_MAX_LIMIT: '5' });

    const noQuery = await request(app).get('/api/users/search');
    const tooMany = await request(app).get('/api/users/search').query({ q: 'a', limit: 6 });

    expect(noQuery.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });
});

describe('admin user management', () => {
  async function signInAsAdmin(app: ReturnType<typeof createDatabaseTestApp>) {
    await createUser(prisma, { username: 'boss', role: 'ADMIN' });
    return signIn(app, 'boss');
  }

  it('is only for ADMINs: 401 without a session and 403 for a USER', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    const { accessToken } = await signIn(app, 'leo');

    const anonymous = await request(app).get('/api/admin/users');
    const asUser = await request(app).get('/api/admin/users').set(bearer(accessToken));

    expect(anonymous.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(readError(asUser.body).code).toBe('FORBIDDEN');
  });

  it('lists users with their email, filtered by text, role and status', async () => {
    const app = createDatabaseTestApp();
    const { accessToken } = await signInAsAdmin(app);
    await createUser(prisma, { username: 'leo', email: 'leo@example.com' });
    await createUser(prisma, { username: 'gone', isActive: false });

    const all = pageSchema.parse(
      (await request(app).get('/api/admin/users').set(bearer(accessToken))).body,
    );
    const admins = pageSchema.parse(
      (await request(app).get('/api/admin/users').query({ role: 'ADMIN' }).set(bearer(accessToken)))
        .body,
    );
    const inactive = pageSchema.parse(
      (
        await request(app)
          .get('/api/admin/users')
          .query({ isActive: 'false' })
          .set(bearer(accessToken))
      ).body,
    );
    const byEmail = pageSchema.parse(
      (await request(app).get('/api/admin/users').query({ q: 'LEO@' }).set(bearer(accessToken)))
        .body,
    );

    expect(all.data).toHaveLength(3);
    expect(all.data[0]).toHaveProperty('email');
    expect(admins.data.map(({ username }) => username)).toEqual(['boss']);
    expect(inactive.data.map(({ username }) => username)).toEqual(['gone']);
    expect(byEmail.data.map(({ username }) => username)).toEqual(['leo']);
  });

  it('deactivates an account: no login, and its sessions end at once', async () => {
    const app = createDatabaseTestApp();
    const { accessToken } = await signInAsAdmin(app);
    const leo = await createUser(prisma, { username: 'leo' });
    const leoSession = await signIn(app, 'leo');

    const response = await request(app)
      .patch(`/api/admin/users/${leo.id}/status`)
      .set(bearer(accessToken))
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { username: 'leo', isActive: false } });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'leo', password: TEST_PASSWORD });
    expect(login.status).toBe(403);
    await request(app).post('/api/auth/refresh').set('Cookie', leoSession.cookie).expect(401);
    await request(app).get('/api/auth/me').set(bearer(leoSession.accessToken)).expect(401);

    await request(app)
      .patch(`/api/admin/users/${leo.id}/status`)
      .set(bearer(accessToken))
      .send({ isActive: true })
      .expect(200);
    await signIn(app, 'leo');
  });

  it('changes the role, and the new role applies to the next request', async () => {
    const app = createDatabaseTestApp();
    const { accessToken } = await signInAsAdmin(app);
    const leo = await createUser(prisma, { username: 'leo' });
    const leoSession = await signIn(app, 'leo');

    await request(app)
      .patch(`/api/admin/users/${leo.id}/role`)
      .set(bearer(accessToken))
      .send({ role: 'ADMIN' })
      .expect(200);

    await request(app).get('/api/admin/users').set(bearer(leoSession.accessToken)).expect(200);
  });

  it('does not let ADMINs change their own account, and answers 404 for unknown users', async () => {
    const app = createDatabaseTestApp();
    const { accessToken, session } = await signInAsAdmin(app);

    const self = await request(app)
      .patch(`/api/admin/users/${session.user.id}/role`)
      .set(bearer(accessToken))
      .send({ role: 'USER' });
    const unknown = await request(app)
      .patch('/api/admin/users/0196f3a2-0000-7000-8000-000000000000/status')
      .set(bearer(accessToken))
      .send({ isActive: false });

    expect(self.status).toBe(400);
    expect(readError(self.body).code).toBe('CANNOT_MODIFY_YOURSELF');
    expect(unknown.status).toBe(404);
  });
});
