import { randomUUID } from 'node:crypto';
import { commentSchema, postSchema } from '@snapia/shared';
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
const commentResponseSchema = z.object({ data: commentSchema });
const commentListSchema = z.object({
  data: z.array(commentSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
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

describe('comments', () => {
  it('creates comments of at most comment_max_length characters and lists them oldest first', async () => {
    const { app, tokens, publicPost } = await scenario();
    await prisma.appSetting.update({ where: { key: 'comment_max_length' }, data: { value: 12 } });
    const comment = (body: string, token = tokens.leo) =>
      request(app).post(`/api/posts/${publicPost.id}/comments`).set(token).send({ body });

    const first = await comment('  ¡Qué rico!  ');
    await comment('Lo quiero', tokens.sol);
    const tooLong = await comment('Un comentario demasiado largo');
    const empty = await comment('   ');

    expect(first.status).toBe(201);
    expect(commentResponseSchema.parse(first.body).data).toMatchObject({
      postId: publicPost.id,
      body: '¡Qué rico!',
      author: { username: 'leo' },
    });
    expect(readError(tooLong.body)).toMatchObject({
      code: 'COMMENT_TOO_LONG',
      details: { maxLength: 12 },
    });
    expect(readError(empty.body).code).toBe('VALIDATION_ERROR');

    const page = commentListSchema.parse(
      (
        await request(app)
          .get(`/api/posts/${publicPost.id}/comments`)
          .query({ limit: 1 })
          .expect(200)
      ).body,
    );
    const next = commentListSchema.parse(
      (
        await request(app)
          .get(`/api/posts/${publicPost.id}/comments`)
          .query({ limit: 1, cursor: page.meta.nextCursor ?? '' })
      ).body,
    );
    expect(page.data.map(({ body }) => body)).toEqual(['¡Qué rico!']);
    expect(next.data.map(({ body }) => body)).toEqual(['Lo quiero']);
    const feed = feedSchema.parse((await request(app).get('/api/feed').set(tokens.leo)).body).data;
    expect(feed.find(({ id }) => id === publicPost.id)?.commentsCount).toBe(2);
  });

  it('does not show hidden comments, nor comments of a post you cannot see', async () => {
    const { app, users, tokens, publicPost, followersPost } = await scenario();
    await prisma.comment.create({
      data: { postId: publicPost.id, userId: users.leo.id, body: 'Oculto', hiddenAt: new Date() },
    });

    const list = commentListSchema.parse(
      (await request(app).get(`/api/posts/${publicPost.id}/comments`)).body,
    );

    expect(list.data).toEqual([]);
    expect((await request(app).get(`/api/posts/${followersPost.id}/comments`)).status).toBe(401);
    expect(
      (await request(app).get(`/api/posts/${followersPost.id}/comments`).set(tokens.sol)).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/posts/${followersPost.id}/comments`)
          .set(tokens.sol)
          .send({ body: 'Hola' })
      ).status,
    ).toBe(403);
  });

  it('lets the author of the comment or of the post delete it', async () => {
    const { app, tokens, publicPost } = await scenario();
    const comment = async (token: Record<string, string>) =>
      commentResponseSchema.parse(
        (
          await request(app)
            .post(`/api/posts/${publicPost.id}/comments`)
            .set(token)
            .send({ body: 'Hola' })
            .expect(201)
        ).body,
      ).data;
    const leos = await comment(tokens.leo);
    const sols = await comment(tokens.sol);
    const remove = (commentId: string, token: Record<string, string>) =>
      request(app).delete(`/api/comments/${commentId}`).set(token);

    expect((await remove(leos.id, tokens.sol)).status).toBe(403);
    expect((await remove(leos.id, {})).status).toBe(401);
    expect((await remove(leos.id, tokens.leo)).status).toBe(204);
    expect((await remove(sols.id, tokens.ana)).status).toBe(204);
    expect(readError((await remove(randomUUID(), tokens.ana)).body).code).toBe('COMMENT_NOT_FOUND');
    expect(await prisma.comment.count()).toBe(0);
  });
});
