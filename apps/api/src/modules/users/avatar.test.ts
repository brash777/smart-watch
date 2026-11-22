import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { meUserSchema, publicUserProfileSchema, spaceSchema } from '@snapia/shared';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  bearer,
  createDatabaseTestApp,
  createSpace,
  createUser,
  signIn,
} from '../../../test/factories';
import { createTestJpeg, createTestPng, NOT_AN_IMAGE } from '../../../test/fixtures/images';
import { readError } from '../../../test/http';
import { createTestConfig } from '../../../test/test-config';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createTestStorage } from '../../../test/test-storage';
import type { StorageProvider } from '../../lib/storage';

const prisma = getTestPrisma();
const { thumbnailSidePx } = createTestConfig().upload;
const meResponseSchema = z.object({ data: meUserSchema });

let storage: StorageProvider;
let storageDirectory: string;
let cleanupStorage: () => Promise<void>;

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, directory: storageDirectory, cleanup: cleanupStorage } = await createTestStorage());
});
afterEach(() => cleanupStorage());
afterAll(disconnectTestPrisma);

async function scenario() {
  const app = createDatabaseTestApp({}, { storage });
  const ana = await createUser(prisma, { username: 'ana' });
  const token = bearer((await signIn(app, 'ana')).accessToken);
  return { app, ana, token };
}

/** Files stored under users/<userId>/avatars/. */
async function storedAvatarFiles(userId: string): Promise<string[]> {
  try {
    return (await readdir(join(storageDirectory, 'users', userId, 'avatars'))).sort();
  } catch {
    return [];
  }
}

async function avatarKeyOf(userId: string): Promise<string | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarKey: true },
  });
  return user.avatarKey;
}

describe('PATCH /api/users/me/avatar', () => {
  it('stores a cleaned photo with a square thumbnail and returns its signed URL', async () => {
    const { app, ana, token } = await scenario();
    const photo = await createTestJpeg({
      width: 64,
      height: 32,
      orientation: 6,
      takenAt: '2024:05:01 10:30:00',
      withGps: true,
    });

    const response = await request(app)
      .patch('/api/users/me/avatar')
      .set(token)
      .attach('avatar', photo, { filename: 'me.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(200);
    const { data } = meResponseSchema.parse(response.body);
    expect(data.username).toBe('ana');

    const avatarKey = await avatarKeyOf(ana.id);
    expect(avatarKey).toMatch(new RegExp(`^users/${ana.id}/avatars/[0-9a-f-]{36}\\.webp$`));
    const thumbnailKey = avatarKey?.replace('.webp', '-thumb.webp') ?? '';
    expect(data.avatarUrl).toBe(await storage.getSignedUrl(thumbnailKey));

    const image = await sharp(await storage.getBuffer(avatarKey ?? '')).metadata();
    expect(image).toMatchObject({ format: 'webp', width: 32, height: 64 });
    expect(image.exif).toBeUndefined();
    const thumbnail = await sharp(await storage.getBuffer(thumbnailKey)).metadata();
    expect(thumbnail).toMatchObject({
      format: 'webp',
      width: thumbnailSidePx,
      height: thumbnailSidePx,
    });
    expect(thumbnail.exif).toBeUndefined();
  });

  it('replaces the previous photo and deletes its files', async () => {
    const { app, ana, token } = await scenario();
    const upload = (file: Buffer, contentType: string) =>
      request(app)
        .patch('/api/users/me/avatar')
        .set(token)
        .attach('avatar', file, { filename: 'me', contentType });

    expect((await upload(await createTestJpeg(), 'image/jpeg')).status).toBe(200);
    const firstKey = await avatarKeyOf(ana.id);
    expect((await upload(await createTestPng(), 'image/png')).status).toBe(200);
    const secondKey = await avatarKeyOf(ana.id);

    expect(secondKey).not.toBe(firstKey);
    const secondFile = secondKey?.split('/').at(-1) ?? '';
    expect(await storedAvatarFiles(ana.id)).toEqual(
      [secondFile, secondFile.replace('.webp', '-thumb.webp')].sort(),
    );
  });

  it('shows the photo wherever the user appears', async () => {
    const { app, ana, token } = await scenario();
    const space = await createSpace(prisma, ana.id, { visibility: 'PUBLIC' });
    await request(app)
      .patch('/api/users/me/avatar')
      .set(token)
      .attach('avatar', await createTestJpeg(), { filename: 'me.jpg', contentType: 'image/jpeg' })
      .expect(200);
    const avatarUrl = await storage.getSignedUrl(
      (await avatarKeyOf(ana.id))?.replace('.webp', '-thumb.webp') ?? '',
    );

    const me = await request(app).get('/api/auth/me').set(token);
    expect(meResponseSchema.parse(me.body).data.avatarUrl).toBe(avatarUrl);

    const profile = await request(app).get('/api/users/ana');
    expect(z.object({ data: publicUserProfileSchema }).parse(profile.body).data.avatarUrl).toBe(
      avatarUrl,
    );

    const spaceResponse = await request(app).get(`/api/spaces/${space.id}`);
    expect(z.object({ data: spaceSchema }).parse(spaceResponse.body).data.owner.avatarUrl).toBe(
      avatarUrl,
    );
  });

  it('keeps avatarUrl null for users without a photo', async () => {
    const { app, token } = await scenario();

    const me = await request(app).get('/api/auth/me').set(token);

    expect(meResponseSchema.parse(me.body).data.avatarUrl).toBeNull();
  });

  it('needs a session', async () => {
    const { app } = await scenario();

    const response = await request(app)
      .patch('/api/users/me/avatar')
      .attach('avatar', await createTestJpeg(), { filename: 'me.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(401);
    expect(readError(response.body).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a missing file, extra files, another field and files that are not images', async () => {
    const { app, ana, token } = await scenario();
    const jpeg = await createTestJpeg();
    const patch = () => request(app).patch('/api/users/me/avatar').set(token);

    const noFile = await patch();
    expect(noFile.status).toBe(400);
    expect(readError(noFile.body).code).toBe('NO_FILES');

    const twoFiles = await patch()
      .attach('avatar', jpeg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('avatar', jpeg, { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(twoFiles.status).toBe(400);
    expect(readError(twoFiles.body)).toMatchObject({
      code: 'TOO_MANY_FILES',
      details: { field: 'avatar', maxFiles: 1 },
    });

    const otherField = await patch().attach('photo', jpeg, {
      filename: 'a.jpg',
      contentType: 'image/jpeg',
    });
    expect(otherField.status).toBe(400);
    expect(readError(otherField.body).code).toBe('TOO_MANY_FILES');

    const notAllowed = await patch().attach('avatar', NOT_AN_IMAGE, {
      filename: 'notes.txt',
      contentType: 'text/plain',
    });
    expect(notAllowed.status).toBe(415);
    expect(readError(notAllowed.body).code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const fakeImage = await patch().attach('avatar', NOT_AN_IMAGE, {
      filename: 'fake.jpg',
      contentType: 'image/jpeg',
    });
    expect(fakeImage.status).toBe(415);
    expect(readError(fakeImage.body).code).toBe('UNSUPPORTED_IMAGE');

    expect(await avatarKeyOf(ana.id)).toBeNull();
    expect(await storedAvatarFiles(ana.id)).toEqual([]);
  });
});
