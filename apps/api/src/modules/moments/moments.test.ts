import { randomUUID } from 'node:crypto';
import { momentGroupSchema, momentSchema } from '@snapia/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addMember,
  bearer,
  createDatabaseTestContext,
  createSpace,
  createUser,
  signIn,
} from '../../../test/factories';
import { createTestJpeg } from '../../../test/fixtures/images';
import { readError } from '../../../test/http';
import type { TestApp } from '../../../test/test-app';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createTestStorage } from '../../../test/test-storage';
import type { StorageProvider } from '../../lib/storage';

const prisma = getTestPrisma();
const momentResponseSchema = z.object({ data: momentSchema });
const feedResponseSchema = z.object({ data: z.array(momentGroupSchema) });
const uploadResponseSchema = z.object({ data: z.array(z.object({ id: z.uuid() })) });

let storage: StorageProvider;
let cleanupStorage: () => Promise<void>;
let context: TestApp | undefined;

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, cleanup: cleanupStorage } = await createTestStorage());
});
afterEach(async () => {
  context = undefined;
  await cleanupStorage();
});
afterAll(disconnectTestPrisma);

/**
 * ana shares snaps of her STUDY Space, where max is a member. leo follows ana; max does not;
 * sol is a stranger.
 */
async function scenario() {
  context = createDatabaseTestContext({}, { storage });
  const { app } = context;
  const users = {
    ana: await createUser(prisma, { username: 'ana' }),
    leo: await createUser(prisma, { username: 'leo' }),
    max: await createUser(prisma, { username: 'max' }),
    sol: await createUser(prisma, { username: 'sol' }),
  };
  await prisma.follow.create({ data: { followerId: users.leo.id, followingId: users.ana.id } });
  const space = await createSpace(prisma, users.ana.id, { visibility: 'MEMBERS' });
  await addMember(prisma, space.id, users.max.id, 'EDITOR');
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    max: bearer((await signIn(app, 'max')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
  };

  async function uploadSnap(token: { Authorization: string } = tokens.ana): Promise<string> {
    const response = await request(app)
      .post(`/api/spaces/${space.id}/snaps`)
      .set(token)
      .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    return uploadResponseSchema.parse(response.body).data[0]?.id ?? '';
  }

  async function share(audience: string, snapId?: string) {
    const response = await request(app)
      .post('/api/moments')
      .set(tokens.ana)
      .send({ snapId: snapId ?? (await uploadSnap()), audience })
      .expect(201);
    return momentResponseSchema.parse(response.body).data;
  }

  async function feedOf(token: { Authorization: string }) {
    const response = await request(app).get('/api/moments/feed').set(token).expect(200);
    return feedResponseSchema.parse(response.body).data;
  }

  return { app, users, space, tokens, uploadSnap, share, feedOf };
}

async function settingValue(key: string): Promise<number> {
  return Number((await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value);
}

describe('POST /api/moments', () => {
  it('shares a snap of the author until moment_ttl_hours from now', async () => {
    const { app, users, space, tokens, uploadSnap } = await scenario();
    const snapId = await uploadSnap();
    const before = Date.now();

    const response = await request(app)
      .post('/api/moments')
      .set(tokens.ana)
      .send({ snapId, audience: 'SPACE_MEMBERS' });

    expect(response.status).toBe(201);
    const { data } = momentResponseSchema.parse(response.body);
    expect(data).toMatchObject({
      audience: 'SPACE_MEMBERS',
      author: { username: 'ana' },
      image: { snapId },
      viewedByMe: true,
      viewsCount: 0,
    });
    expect(data.image.imageUrl).toMatch(/^file:\/\//);
    const ttlMs = (await settingValue('moment_ttl_hours')) * 3_600_000;
    const expiresAt = Date.parse(data.expiresAt);
    expect(expiresAt).toBeGreaterThanOrEqual(before + ttlMs);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + ttlMs);
    const stored = await prisma.moment.findUniqueOrThrow({ where: { id: data.id } });
    expect(stored).toMatchObject({ authorId: users.ana.id, spaceId: space.id });
  });

  it('only lets the author of a snap share it', async () => {
    const { app, tokens, uploadSnap } = await scenario();
    const anasSnap = await uploadSnap();
    const share = (token: Record<string, string>, snapId: string, audience = 'PUBLIC') =>
      request(app).post('/api/moments').set(token).send({ snapId, audience });

    expect(readError((await share(tokens.max, anasSnap)).body).code).toBe('NOT_SNAP_AUTHOR');
    expect(readError((await share(tokens.ana, randomUUID())).body).code).toBe('SNAP_NOT_FOUND');
    expect(readError((await share(tokens.ana, anasSnap, 'FRIENDS')).body).code).toBe(
      'VALIDATION_ERROR',
    );
    expect((await share({}, anasSnap)).status).toBe(401);
  });
});

describe('GET /api/moments/feed', () => {
  it('shows the active Moments of the people you follow and your own, by author', async () => {
    const { tokens, share, feedOf } = await scenario();
    const first = await share('FOLLOWERS');
    const second = await share('PUBLIC');

    const leosFeed = await feedOf(tokens.leo);
    const anasFeed = await feedOf(tokens.ana);
    const solsFeed = await feedOf(tokens.sol);

    expect(leosFeed).toHaveLength(1);
    expect(leosFeed[0]).toMatchObject({ author: { username: 'ana' }, hasUnseen: true });
    expect(leosFeed[0]?.moments.map(({ id }) => id)).toEqual([first.id, second.id]);
    expect(leosFeed[0]?.moments[0]?.viewsCount).toBeNull();
    expect(anasFeed[0]).toMatchObject({ author: { username: 'ana' }, hasUnseen: false });
    // sol does not follow ana: even her PUBLIC Moment stays out of sol's feed.
    expect(solsFeed).toEqual([]);
  });

  it('does not show an expired Moment', async () => {
    const { app, tokens, share, feedOf } = await scenario();
    const expired = await share('FOLLOWERS');
    const active = await share('FOLLOWERS');
    await prisma.moment.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const feed = await feedOf(tokens.leo);
    const view = await request(app).post(`/api/moments/${expired.id}/view`).set(tokens.leo);

    expect(feed[0]?.moments.map(({ id }) => id)).toEqual([active.id]);
    expect(view.status).toBe(404);
    expect(readError(view.body).code).toBe('MOMENT_NOT_FOUND');
  });

  it('shows SPACE_MEMBERS Moments only to the members of the Space', async () => {
    const { tokens, users, share, feedOf } = await scenario();
    await prisma.follow.create({ data: { followerId: users.max.id, followingId: users.ana.id } });
    await prisma.follow.create({ data: { followerId: users.sol.id, followingId: users.ana.id } });
    const forMembers = await share('SPACE_MEMBERS');

    const membersFeed = await feedOf(tokens.max);
    const followerFeed = await feedOf(tokens.sol);

    expect(membersFeed[0]?.moments.map(({ id }) => id)).toEqual([forMembers.id]);
    expect(followerFeed).toEqual([]);
  });
});

describe('POST /api/moments/:id/view', () => {
  it('records one view per person, not counting the author', async () => {
    const { app, tokens, share, feedOf } = await scenario();
    const moment = await share('FOLLOWERS');
    const view = (token: Record<string, string>) =>
      request(app).post(`/api/moments/${moment.id}/view`).set(token);

    expect((await view(tokens.leo)).status).toBe(204);
    expect((await view(tokens.leo)).status).toBe(204);
    expect((await view(tokens.ana)).status).toBe(204);

    expect(await prisma.momentView.count({ where: { momentId: moment.id } })).toBe(1);
    expect((await feedOf(tokens.leo))[0]).toMatchObject({ hasUnseen: false });
    expect((await feedOf(tokens.ana))[0]?.moments[0]?.viewsCount).toBe(1);
  });

  it('answers 403 to someone the Moment is not shared with', async () => {
    const { app, tokens, share } = await scenario();
    const moment = await share('FOLLOWERS');

    const response = await request(app).post(`/api/moments/${moment.id}/view`).set(tokens.sol);

    expect(response.status).toBe(403);
    expect(await prisma.momentView.count()).toBe(0);
    expect((await request(app).post(`/api/moments/${moment.id}/view`)).status).toBe(401);
  });
});
