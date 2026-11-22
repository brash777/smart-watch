import { randomUUID } from 'node:crypto';
import { likeStateSchema, postSchema } from '@snapia/shared';
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
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createTestStorage } from '../../../test/test-storage';
import type { StorageProvider } from '../../lib/storage';

const prisma = getTestPrisma();
const likeResponseSchema = z.object({ data: likeStateSchema });
const feedSchema = z.object({ data: z.array(postSchema) });

let storage: StorageProvider;
let cleanupStorage: () => Promise<void>;

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, cleanup: cleanupStorage } = await createTestStorage());
});
afterEach(() => cleanupStorage());
afterAll(disconnectTestPrisma);

/** ana published a PUBLIC post and a FOLLOWERS post; leo follows ana; sol does not. */
async function scenario() {
  const app = createDatabaseTestContext({}, { storage }).app;
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
  const space = await createSpace(prisma, users.ana.id, { mode: 'CONTENT' });
  const upload = await request(app)
    .post(`/api/spaces/${space.id}/snaps`)
    .set(tokens.ana)
    .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
    .attach('files', await createTestJpeg(), { filename: 'b.jpg', contentType: 'image/jpeg' })
    .expect(201);
  const [first, second] = z
    .object({ data: z.array(z.object({ id: z.uuid() })) })
    .parse(upload.body)
    .data.map(({ id }) => id);
  const publish = async (snapId: string | undefined, visibility: string) =>
    z.object({ data: postSchema }).parse(
      (
        await request(app)
          .post('/api/posts')
          .set(tokens.ana)
          .send({ snapIds: [snapId], caption: visibility, visibility })
          .expect(201)
      ).body,
    ).data;
  return {
    app,
    users,
    tokens,
    publicPost: await publish(first, 'PUBLIC'),
    followersPost: await publish(second, 'FOLLOWERS'),
  };
}

describe('POST /api/posts/:id/like', () => {
  it('likes and takes the like back, and the feed shows it', async () => {
    const { app, tokens, publicPost } = await scenario();
    const like = () => request(app).post(`/api/posts/${publicPost.id}/like`).set(tokens.leo);

    const liked = likeResponseSchema.parse((await like().expect(200)).body).data;
    const feed = feedSchema.parse((await request(app).get('/api/feed').set(tokens.leo)).body).data;
    const unliked = likeResponseSchema.parse((await like().expect(200)).body).data;

    expect(liked).toEqual({ liked: true, likesCount: 1 });
    expect(feed.find(({ id }) => id === publicPost.id)).toMatchObject({
      likesCount: 1,
      likedByMe: true,
    });
    expect(unliked).toEqual({ liked: false, likesCount: 0 });
    expect(await prisma.like.count()).toBe(0);
  });

  it('only works on posts you can see', async () => {
    const { app, tokens, publicPost, followersPost } = await scenario();
    const like = (postId: string, token: Record<string, string>) =>
      request(app).post(`/api/posts/${postId}/like`).set(token);

    expect((await like(followersPost.id, tokens.sol)).status).toBe(403);
    expect((await like(followersPost.id, tokens.leo)).status).toBe(200);
    expect((await like(publicPost.id, {})).status).toBe(401);
    expect(readError((await like(randomUUID(), tokens.leo)).body).code).toBe('POST_NOT_FOUND');
    await prisma.post.update({ where: { id: publicPost.id }, data: { hiddenAt: new Date() } });
    expect((await like(publicPost.id, tokens.leo)).status).toBe(404);
  });
});
