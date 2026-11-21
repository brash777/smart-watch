import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDatabaseTestApp, createUser, signIn } from '../../../test/factories';
import { readError } from '../../../test/http';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';

const prisma = getTestPrisma();

const userPageSchema = z.object({
  data: z.array(z.object({ username: z.string() }).loose()),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

describe('POST /api/users/:username/follow', () => {
  it('follows a user and is idempotent', async () => {
    const app = createDatabaseTestApp();
    const leo = await createUser(prisma, { username: 'leo' });
    await createUser(prisma, { username: 'ana' });
    const { accessToken } = await signIn(app, 'ana');

    const first = await request(app).post('/api/users/leo/follow').set(bearer(accessToken));
    const second = await request(app).post('/api/users/LEO/follow').set(bearer(accessToken));

    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      data: { username: 'leo', isFollowedByMe: true, followersCount: 1 },
    });
    expect(second.body).toEqual(first.body);
    expect(await prisma.follow.count({ where: { followingId: leo.id } })).toBe(1);

    const profile = await request(app).get('/api/users/leo').set(bearer(accessToken));
    expect(profile.body).toMatchObject({
      data: { isFollowedByMe: true, counts: { followers: 1 } },
    });
  });

  it('does not let you follow yourself', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'leo' });
    const { accessToken } = await signIn(app, 'leo');

    const response = await request(app).post('/api/users/leo/follow').set(bearer(accessToken));

    expect(response.status).toBe(400);
    expect(readError(response.body).code).toBe('CANNOT_FOLLOW_YOURSELF');
  });

  it('answers 404 for unknown or deactivated users and 401 without a session', async () => {
    const app = createDatabaseTestApp();
    await createUser(prisma, { username: 'ana' });
    await createUser(prisma, { username: 'gone', isActive: false });
    const { accessToken } = await signIn(app, 'ana');

    const unknown = await request(app).post('/api/users/nobody/follow').set(bearer(accessToken));
    const deactivated = await request(app).post('/api/users/gone/follow').set(bearer(accessToken));
    const anonymous = await request(app).post('/api/users/ana/follow');

    expect(unknown.status).toBe(404);
    expect(deactivated.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });
});

describe('DELETE /api/users/:username/follow', () => {
  it('unfollows a user and is idempotent', async () => {
    const app = createDatabaseTestApp();
    const leo = await createUser(prisma, { username: 'leo' });
    const ana = await createUser(prisma, { username: 'ana' });
    await prisma.follow.create({ data: { followerId: ana.id, followingId: leo.id } });
    const { accessToken } = await signIn(app, 'ana');

    const first = await request(app).delete('/api/users/leo/follow').set(bearer(accessToken));
    const second = await request(app).delete('/api/users/leo/follow').set(bearer(accessToken));

    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      data: { username: 'leo', isFollowedByMe: false, followersCount: 0 },
    });
    expect(second.status).toBe(200);
    expect(await prisma.follow.count()).toBe(0);
  });
});

describe('followers and following lists', () => {
  it('lists followers newest first, paginated, without deactivated users', async () => {
    const app = createDatabaseTestApp();
    const leo = await createUser(prisma, { username: 'leo' });
    for (const username of ['first', 'second', 'third']) {
      const follower = await createUser(prisma, { username });
      await prisma.follow.create({ data: { followerId: follower.id, followingId: leo.id } });
    }
    const gone = await createUser(prisma, { username: 'gone', isActive: false });
    await prisma.follow.create({ data: { followerId: gone.id, followingId: leo.id } });

    const firstPage = userPageSchema.parse(
      (await request(app).get('/api/users/leo/followers').query({ limit: 2 })).body,
    );
    const secondPage = userPageSchema.parse(
      (
        await request(app)
          .get('/api/users/leo/followers')
          .query({ limit: 2, cursor: firstPage.meta.nextCursor })
      ).body,
    );

    expect(firstPage.data.map(({ username }) => username)).toEqual(['third', 'second']);
    expect(secondPage.data.map(({ username }) => username)).toEqual(['first']);
    expect(secondPage.meta.nextCursor).toBeNull();
    expect(JSON.stringify(firstPage)).not.toMatch(/email/);
  });

  it('lists the users someone follows', async () => {
    const app = createDatabaseTestApp();
    const ana = await createUser(prisma, { username: 'ana' });
    const leo = await createUser(prisma, { username: 'leo' });
    await prisma.follow.create({ data: { followerId: ana.id, followingId: leo.id } });

    const response = await request(app).get('/api/users/ana/following');

    expect(response.status).toBe(200);
    expect(userPageSchema.parse(response.body).data.map(({ username }) => username)).toEqual([
      'leo',
    ]);
  });

  it('answers 404 for an unknown user', async () => {
    const app = createDatabaseTestApp();

    const response = await request(app).get('/api/users/nobody/followers');

    expect(response.status).toBe(404);
  });
});
