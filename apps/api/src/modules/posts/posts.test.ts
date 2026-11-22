import { randomUUID } from 'node:crypto';
import { postDraftSchema, postSchema, trendingHashtagSchema, type SpaceMode } from '@snapia/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  bearer,
  createDatabaseTestContext,
  createSpace,
  createUser,
  signIn,
} from '../../../test/factories';
import { createTestJpeg } from '../../../test/fixtures/images';
import { readError } from '../../../test/http';
import type { TestApp } from '../../../test/test-app';
import { createTestConfig } from '../../../test/test-config';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createTestStorage } from '../../../test/test-storage';
import type { StorageProvider } from '../../lib/storage';
import { createMockAiProvider, type MockAiProvider } from '../ai/providers/mock-ai-provider';

const prisma = getTestPrisma();
const postResponseSchema = z.object({ data: postSchema });
const postListSchema = z.object({
  data: z.array(postSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
const uploadResponseSchema = z.object({ data: z.array(z.object({ id: z.uuid() })) });

let storage: StorageProvider;
let cleanupStorage: () => Promise<void>;
let provider: MockAiProvider;
let context: TestApp | undefined;

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, cleanup: cleanupStorage } = await createTestStorage());
  provider = createMockAiProvider({ model: createTestConfig().ai.model });
});
afterEach(async () => {
  context?.aiQueue.stop();
  await context?.aiQueue.onIdle();
  context = undefined;
  await cleanupStorage();
});
afterAll(disconnectTestPrisma);

async function settingValue(key: string): Promise<unknown> {
  return (await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value;
}

/** ana posts snaps of her Spaces; leo follows ana; sol is a stranger. */
async function scenario() {
  context = createDatabaseTestContext({}, { storage, aiProvider: provider });
  const { app, aiQueue } = context;
  const users = {
    ana: await createUser(prisma, { username: 'ana' }),
    leo: await createUser(prisma, { username: 'leo' }),
    sol: await createUser(prisma, { username: 'sol' }),
  };
  await prisma.follow.create({ data: { followerId: users.leo.id, followingId: users.ana.id } });
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
  };
  const spaces = {
    CONTENT: await createSpace(prisma, users.ana.id, { mode: 'CONTENT' }),
    WORK: await createSpace(prisma, users.ana.id, { mode: 'WORK' }),
  };
  await aiQueue.start();

  /** Snaps of ana in a Space of the given mode, analyzed by the mock AI. */
  async function snaps(mode: 'CONTENT' | 'WORK', count = 1): Promise<string[]> {
    let upload = request(app).post(`/api/spaces/${spaces[mode].id}/snaps`).set(tokens.ana);
    for (let index = 0; index < count; index += 1) {
      upload = upload.attach('files', await createTestJpeg(), {
        filename: `${String(index)}.jpg`,
        contentType: 'image/jpeg',
      });
    }
    const response = await upload.expect(201);
    await aiQueue.onIdle();
    return uploadResponseSchema.parse(response.body).data.map(({ id }) => id);
  }

  async function publish(body: Record<string, unknown>, token = tokens.ana) {
    const response = await request(app).post('/api/posts').set(token).send(body).expect(201);
    return postResponseSchema.parse(response.body).data;
  }

  return { app, users, tokens, spaces, snaps, publish };
}

describe('POST /api/posts', () => {
  it('publishes the snaps of the author with normalized hashtags and alt texts from CONTENT insights', async () => {
    const { app, users, tokens, spaces, snaps } = await scenario();
    const snapIds = await snaps('CONTENT', 2);

    const response = await request(app)
      .post('/api/posts')
      .set(tokens.ana)
      .send({
        snapIds,
        caption: '  Nuevo pastel  ',
        hashtags: ['#Repostería', 'chocolate', 'repostería'],
      });

    expect(response.status).toBe(201);
    const { data } = postResponseSchema.parse(response.body);
    expect(data).toMatchObject({
      caption: 'Nuevo pastel',
      hashtags: ['repostería', 'chocolate'],
      visibility: 'PUBLIC',
      likesCount: 0,
      commentsCount: 0,
      likedByMe: false,
      author: { username: 'ana' },
    });
    expect(data.media.map(({ snapId, order }) => [snapId, order])).toEqual([
      [snapIds[0], 1],
      [snapIds[1], 2],
    ]);
    expect(data.media[0]?.altText).toContain('Pastel de chocolate');
    expect(data.media[0]?.imageUrl).toMatch(/^file:\/\//);
    const stored = await prisma.post.findUniqueOrThrow({ where: { id: data.id } });
    expect(stored).toMatchObject({ authorId: users.ana.id, spaceId: spaces.CONTENT.id });
  });

  it('only publishes snaps of the author, up to max_snaps_per_post', async () => {
    const { app, tokens, snaps } = await scenario();
    const [anasSnap] = await snaps('WORK');
    await prisma.appSetting.update({ where: { key: 'max_snaps_per_post' }, data: { value: 1 } });
    const publish = (token: Record<string, string>, snapIds: string[]) =>
      request(app).post('/api/posts').set(token).send({ snapIds, caption: 'Hola' });

    expect(readError((await publish(tokens.leo, [anasSnap ?? ''])).body).code).toBe(
      'NOT_SNAP_AUTHOR',
    );
    expect(readError((await publish(tokens.ana, [randomUUID()])).body).code).toBe('SNAP_NOT_FOUND');
    expect(
      readError((await publish(tokens.ana, [anasSnap ?? '', randomUUID()])).body),
    ).toMatchObject({
      code: 'TOO_MANY_SNAPS',
      details: { limit: 1 },
    });
    expect(readError((await publish(tokens.ana, [])).body).code).toBe('VALIDATION_ERROR');
    expect((await publish({}, [anasSnap ?? ''])).status).toBe(401);
    expect(await prisma.post.count()).toBe(0);
  });
});

describe('POST /api/posts/draft', () => {
  it('takes the caption and the hashtags from CONTENT insights, without calling the AI', async () => {
    const { app, tokens, snaps } = await scenario();
    const snapIds = await snaps('CONTENT', 2);
    const callsBefore = provider.calls.length;

    const response = await request(app).post('/api/posts/draft').set(tokens.ana).send({ snapIds });

    expect(response.status).toBe(200);
    const { data } = z.object({ data: postDraftSchema }).parse(response.body);
    expect(data.caption).toContain('Chocolate intenso');
    const defaults = z.array(z.string()).parse(await settingValue('default_hashtags'));
    expect(data.hashtags.slice(0, defaults.length)).toEqual(defaults);
    expect(data.hashtags).toContain('repostería');
    expect(provider.calls.length).toBe(callsBefore);
  });

  it('asks the AI for snaps of other modes', async () => {
    const { app, tokens, snaps } = await scenario();
    const snapIds = await snaps('WORK');

    const response = await request(app).post('/api/posts/draft').set(tokens.ana).send({ snapIds });

    expect(response.status).toBe(200);
    expect(provider.calls.at(-1)?.request.promptName).toBe('post-draft');
    const run = await prisma.aiRun.findFirstOrThrow({ where: { task: 'POST_DRAFT' } });
    expect(run.status).toBe('COMPLETED');
  });

  it('needs analyzed snaps', async () => {
    const { app, tokens, snaps } = await scenario();
    const [snapId] = await snaps('WORK');
    await prisma.snap.update({ where: { id: snapId ?? '' }, data: { analysisStatus: 'PENDING' } });

    const response = await request(app)
      .post('/api/posts/draft')
      .set(tokens.ana)
      .send({ snapIds: [snapId] });

    expect(response.status).toBe(409);
    expect(readError(response.body).code).toBe('SNAPS_NOT_ANALYZED');
  });
});

describe('GET /api/feed', () => {
  it('shows the posts of the people you follow and your own, newest first, page by page', async () => {
    const { app, tokens, snaps, publish } = await scenario();
    const [first, second, third] = await snaps('CONTENT', 3);
    const older = await publish({ snapIds: [first], caption: 'Uno', visibility: 'FOLLOWERS' });
    const newer = await publish({ snapIds: [second], caption: 'Dos' });
    await publish({ snapIds: [third], caption: 'Tres' });
    await prisma.post.update({
      where: { id: older.id },
      data: { publishedAt: new Date(Date.now() - 60_000) },
    });

    const page = postListSchema.parse(
      (await request(app).get('/api/feed').query({ limit: 2 }).set(tokens.leo).expect(200)).body,
    );
    const next = postListSchema.parse(
      (
        await request(app)
          .get('/api/feed')
          .query({ limit: 2, cursor: page.meta.nextCursor ?? '' })
          .set(tokens.leo)
      ).body,
    );
    const strangersFeed = postListSchema.parse(
      (await request(app).get('/api/feed').set(tokens.sol)).body,
    );

    expect(page.data.map(({ caption }) => caption)).toEqual(['Tres', 'Dos']);
    expect(next.data.map(({ id }) => id)).toEqual([older.id]);
    expect(next.meta.nextCursor).toBeNull();
    expect(page.data[1]?.id).toBe(newer.id);
    expect(strangersFeed.data).toEqual([]);
    expect((await request(app).get('/api/feed')).status).toBe(401);
  });
});

describe('GET /api/users/:username/posts (portfolio)', () => {
  it('shows PUBLIC posts to everyone and FOLLOWERS posts only to followers', async () => {
    const { app, tokens, snaps, publish } = await scenario();
    const [first, second] = await snaps('CONTENT', 2);
    await publish({ snapIds: [first], caption: 'Público' });
    await publish({ snapIds: [second], caption: 'Seguidores', visibility: 'FOLLOWERS' });
    const portfolio = async (token: Record<string, string> = {}) =>
      postListSchema
        .parse((await request(app).get('/api/users/ana/posts').set(token).expect(200)).body)
        .data.map(({ caption }) => caption);

    expect(await portfolio()).toEqual(['Público']);
    expect(await portfolio(tokens.sol)).toEqual(['Público']);
    expect(await portfolio(tokens.leo)).toEqual(['Seguidores', 'Público']);
    expect(await portfolio(tokens.ana)).toEqual(['Seguidores', 'Público']);
    expect(readError((await request(app).get('/api/users/nadie/posts')).body).code).toBe(
      'USER_NOT_FOUND',
    );
  });
});

describe('DELETE /api/posts/:id', () => {
  it('lets only the author delete a post', async () => {
    const { app, tokens, snaps, publish } = await scenario();
    const post = await publish({ snapIds: await snaps('CONTENT'), caption: 'Hola' });
    const remove = (token: Record<string, string>, id = post.id) =>
      request(app).delete(`/api/posts/${id}`).set(token);

    expect((await remove(tokens.leo)).status).toBe(403);
    expect((await remove({})).status).toBe(401);
    expect(readError((await remove(tokens.ana, randomUUID())).body).code).toBe('POST_NOT_FOUND');
    expect((await remove(tokens.ana)).status).toBe(204);
    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.snap.count()).toBe(1);
  });
});

describe('Explore', () => {
  it('finds PUBLIC posts by hashtag, written with or without #', async () => {
    const { app, snaps, publish } = await scenario();
    const [first, second, third] = await snaps('CONTENT', 3);
    await publish({ snapIds: [first], caption: 'Pastel', hashtags: ['repostería'] });
    await publish({
      snapIds: [second],
      caption: 'Oculto',
      hashtags: ['repostería'],
      visibility: 'FOLLOWERS',
    });
    await publish({ snapIds: [third], caption: 'Otro', hashtags: ['viajes'] });

    const byTag = postListSchema.parse(
      (await request(app).get('/api/explore').query({ hashtag: '#Repostería' }).expect(200)).body,
    );
    const all = postListSchema.parse((await request(app).get('/api/explore').expect(200)).body);

    expect(byTag.data.map(({ caption }) => caption)).toEqual(['Pastel']);
    expect(all.data.map(({ caption }) => caption)).toEqual(['Otro', 'Pastel']);
  });

  it('ranks the hashtags of recent PUBLIC posts', async () => {
    const { app, snaps, publish } = await scenario();
    const [a, b, c, d] = await snaps('CONTENT', 4);
    await publish({ snapIds: [a], caption: '1', hashtags: ['pastel', 'chocolate'] });
    await publish({ snapIds: [b], caption: '2', hashtags: ['pastel'] });
    await publish({
      snapIds: [c],
      caption: '3',
      hashtags: ['pastel', 'privado'],
      visibility: 'FOLLOWERS',
    });
    const old = await publish({ snapIds: [d], caption: '4', hashtags: ['antiguo'] });
    const days = Number(await settingValue('trending_hashtags_days'));
    await prisma.post.update({
      where: { id: old.id },
      data: { publishedAt: new Date(Date.now() - (days + 1) * 86_400_000) },
    });

    const response = await request(app).get('/api/explore/trending').expect(200);

    expect(z.object({ data: z.array(trendingHashtagSchema) }).parse(response.body).data).toEqual([
      { hashtag: 'pastel', postsCount: 2 },
      { hashtag: 'chocolate', postsCount: 1 },
    ]);
  });
});

describe.each(['CONTENT', 'WORK'] satisfies SpaceMode[])('posts from a %s Space', (mode) => {
  it('keep the Space of the snaps', async () => {
    const { spaces, snaps, publish } = await scenario();

    const post = await publish({ snapIds: await snaps(mode), caption: 'Hola' });

    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).spaceId).toBe(
      spaces[mode].id,
    );
  });
});
