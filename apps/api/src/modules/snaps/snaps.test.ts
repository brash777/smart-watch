import exifReader from 'exif-reader';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addMember,
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
import { EventBus } from '../../lib/events';
import { createLogger } from '../../lib/logger';
import type { StorageProvider } from '../../lib/storage';

const prisma = getTestPrisma();

const snapItemSchema = z
  .object({
    id: z.string(),
    note: z.string().nullable(),
    tags: z.array(z.string()),
    takenAt: z.string(),
    width: z.number(),
    height: z.number(),
    analysisStatus: z.string(),
    thumbnailUrl: z.string(),
    author: z.object({ username: z.string() }).loose(),
  })
  .loose();
const snapListSchema = z.object({
  data: z.array(snapItemSchema),
  meta: z.object({ nextCursor: z.string().nullable() }).optional(),
});

let storage: StorageProvider;
let cleanupStorage: () => Promise<void>;
let events: EventBus;
let createdSnapIds: string[];

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, cleanup: cleanupStorage } = await createTestStorage());
  events = new EventBus(createLogger(createTestConfig()));
  createdSnapIds = [];
  events.on('snap.created', ({ snapId }) => {
    createdSnapIds.push(snapId);
  });
});
afterEach(() => cleanupStorage());
afterAll(disconnectTestPrisma);

/** ana owns a MEMBERS STUDY Space with leo as EDITOR and sol as VIEWER. */
async function scenario(overrides: Record<string, string> = {}) {
  const app = createDatabaseTestApp(overrides, { storage, events });
  const ana = await createUser(prisma, { username: 'ana' });
  const leo = await createUser(prisma, { username: 'leo' });
  const sol = await createUser(prisma, { username: 'sol' });
  await createUser(prisma, { username: 'out' });
  const space = await createSpace(prisma, ana.id, { mode: 'STUDY', visibility: 'MEMBERS' });
  await addMember(prisma, space.id, leo.id, 'EDITOR');
  await addMember(prisma, space.id, sol.id, 'VIEWER');
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
    out: bearer((await signIn(app, 'out')).accessToken),
  };
  const uploadUrl = `/api/spaces/${space.id}/snaps`;
  return { app, space, users: { ana, leo, sol }, tokens, uploadUrl };
}

describe('POST /api/spaces/:spaceId/snaps', () => {
  it('uploads several photos as PENDING snaps, cleaned and stored, and emits snap.created', async () => {
    const { app, space, tokens, uploadUrl } = await scenario();
    const withGps = await createTestJpeg({
      width: 64,
      height: 32,
      orientation: 6,
      takenAt: '2024:05:01 10:30:00',
      withGps: true,
    });
    const before = Date.now();

    const response = await request(app)
      .post(uploadUrl)
      .set(tokens.leo)
      .field('note', '  Clase 3  ')
      .field('tags', 'Pizarra, examen,pizarra')
      .attach('files', withGps, { filename: 'board.jpg', contentType: 'image/jpeg' })
      .attach('files', await createTestJpeg(), { filename: 'b.jpg', contentType: 'image/jpeg' })
      .attach('files', await createTestPng(), { filename: 'c.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    const { data } = snapListSchema.parse(response.body);
    expect(data).toHaveLength(3);
    for (const snap of data) {
      expect(snap).toMatchObject({
        note: 'Clase 3',
        tags: ['pizarra', 'examen'],
        analysisStatus: 'PENDING',
        author: { username: 'leo' },
      });
    }
    expect(data[0]?.takenAt).toBe('2024-05-01T10:30:00.000Z');
    expect(Date.parse(data[1]?.takenAt ?? '')).toBeGreaterThanOrEqual(before - 1000);
    expect(data[0]?.height).toBeGreaterThan(data[0]?.width ?? 0);
    expect(createdSnapIds.sort()).toEqual(data.map(({ id }) => id).sort());

    const stored = await prisma.snap.findMany({ where: { spaceId: space.id } });
    expect(stored).toHaveLength(3);
    for (const snap of stored) {
      expect(snap.storageKey).toMatch(
        new RegExp(`^spaces/${space.id}/snaps/[0-9a-f-]{36}\\.webp$`),
      );
      expect(snap.thumbnailKey).toBe(snap.storageKey.replace('.webp', '-thumb.webp'));
      expect(snap.mimeType).toBe('image/webp');
      for (const key of [snap.storageKey, snap.thumbnailKey]) {
        const metadata = await sharp(await storage.getBuffer(key)).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.exif).toBeUndefined();
      }
    }
  });

  it('keeps no EXIF and no GPS location in the stored files', async () => {
    const { app, tokens, uploadUrl } = await scenario();
    const original = await createTestJpeg({ takenAt: '2024:05:01 10:30:00', withGps: true });
    const originalMetadata = await sharp(original).metadata();
    expect(exifReader(originalMetadata.exif ?? Buffer.alloc(0)).GPSInfo).toBeDefined();

    const response = await request(app)
      .post(uploadUrl)
      .set(tokens.ana)
      .attach('files', original, { filename: 'gps.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const [snap] = snapListSchema.parse(response.body).data;
    const stored = await prisma.snap.findUniqueOrThrow({ where: { id: snap?.id ?? '' } });
    for (const key of [stored.storageKey, stored.thumbnailKey]) {
      const bytes = await storage.getBuffer(key);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(bytes.includes('FixtureCam')).toBe(false);
    }
  });

  it('only lets EDITORs and OWNERs upload', async () => {
    const { app, tokens, uploadUrl } = await scenario();
    const photo = await createTestJpeg();
    const send = (headers: { Authorization: string } | Record<string, never>) =>
      request(app)
        .post(uploadUrl)
        .set(headers)
        .attach('files', photo, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect((await send(tokens.sol)).status).toBe(403);
    expect((await send(tokens.out)).status).toBe(403);
    expect((await send({})).status).toBe(401);
    expect((await send(tokens.ana)).status).toBe(201);
  });

  it('rejects uploads without files, with wrong types or with fake images', async () => {
    const { app, tokens, uploadUrl } = await scenario();

    const noFiles = await request(app).post(uploadUrl).set(tokens.ana).field('note', 'x');
    const textFile = await request(app)
      .post(uploadUrl)
      .set(tokens.ana)
      .attach('files', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    const fakeImage = await request(app)
      .post(uploadUrl)
      .set(tokens.ana)
      .attach('files', NOT_AN_IMAGE, { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(readError(noFiles.body).code).toBe('NO_FILES');
    expect(textFile.status).toBe(415);
    expect(readError(textFile.body).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(fakeImage.status).toBe(415);
    expect(readError(fakeImage.body).code).toBe('UNSUPPORTED_IMAGE');
    expect(await prisma.snap.count()).toBe(0);
  });

  it('applies UPLOAD_MAX_MB and UPLOAD_MAX_FILES', async () => {
    const tooBig = await scenario({ UPLOAD_MAX_MB: '0.0001' });
    const big = await request(tooBig.app)
      .post(tooBig.uploadUrl)
      .set(tooBig.tokens.ana)
      .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(big.status).toBe(413);
    expect(readError(big.body).code).toBe('FILE_TOO_LARGE');

    await resetTestDatabase();
    const fewFiles = await scenario({ UPLOAD_MAX_FILES: '1' });
    const photo = await createTestJpeg();
    const many = await request(fewFiles.app)
      .post(fewFiles.uploadUrl)
      .set(fewFiles.tokens.ana)
      .attach('files', photo, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('files', photo, { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(many.status).toBe(400);
    expect(readError(many.body).code).toBe('TOO_MANY_FILES');
  });

  it('applies max_snaps_per_space and refuses archived Spaces', async () => {
    const { app, space, tokens, uploadUrl } = await scenario();
    await prisma.appSetting.update({ where: { key: 'max_snaps_per_space' }, data: { value: 1 } });
    const photo = await createTestJpeg();

    const overLimit = await request(app)
      .post(uploadUrl)
      .set(tokens.ana)
      .attach('files', photo, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('files', photo, { filename: 'b.jpg', contentType: 'image/jpeg' });
    await prisma.space.update({ where: { id: space.id }, data: { archivedAt: new Date() } });
    const archived = await request(app)
      .post(uploadUrl)
      .set(tokens.ana)
      .attach('files', photo, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(overLimit.status).toBe(409);
    expect(readError(overLimit.body).code).toBe('SNAP_LIMIT_REACHED');
    expect(readError(archived.body).code).toBe('SPACE_ARCHIVED');
  });

  it('lets a user who joined with an invite code upload as EDITOR', async () => {
    const { app, space, tokens } = await scenario();
    const invite = await request(app)
      .post(`/api/spaces/${space.id}/invites`)
      .set(tokens.ana)
      .send({ role: 'EDITOR' });
    const code = z.object({ data: z.object({ code: z.string() }) }).parse(invite.body).data.code;

    await request(app).post('/api/spaces/join').set(tokens.out).send({ code }).expect(200);
    const upload = await request(app)
      .post(`/api/spaces/${space.id}/snaps`)
      .set(tokens.out)
      .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(upload.status).toBe(201);
  });
});

describe('GET /api/spaces/:spaceId/snaps', () => {
  async function seededScenario() {
    const context = await scenario();
    const upload = async (token: { Authorization: string }, takenAt: string, tags: string) =>
      request(context.app)
        .post(context.uploadUrl)
        .set(token)
        .field('tags', tags)
        .attach('files', await createTestJpeg({ takenAt }), {
          filename: 'a.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
    await upload(context.tokens.ana, '2024:01:10 09:00:00', 'teoria');
    await upload(context.tokens.leo, '2024:02:10 09:00:00', 'examen');
    await upload(context.tokens.leo, '2024:03:10 09:00:00', 'examen,teoria');
    return context;
  }

  it('lists the snaps newest first, with signed thumbnail URLs and pagination', async () => {
    const { app, space, tokens } = await seededScenario();

    const first = snapListSchema.parse(
      (await request(app).get(`/api/spaces/${space.id}/snaps`).query({ limit: 2 }).set(tokens.sol))
        .body,
    );
    const second = snapListSchema.parse(
      (
        await request(app)
          .get(`/api/spaces/${space.id}/snaps`)
          .query({ limit: 2, cursor: first.meta?.nextCursor })
          .set(tokens.sol)
      ).body,
    );

    expect(first.data.map(({ takenAt }) => takenAt.slice(0, 7))).toEqual(['2024-03', '2024-02']);
    expect(second.data.map(({ takenAt }) => takenAt.slice(0, 7))).toEqual(['2024-01']);
    expect(first.data[0]?.thumbnailUrl).toMatch(/^file:\/\//);
  });

  it('filters by tag, author, date range and analysis status', async () => {
    const { app, space, users, tokens } = await seededScenario();
    const list = async (query: Record<string, string>) =>
      snapListSchema
        .parse(
          (await request(app).get(`/api/spaces/${space.id}/snaps`).query(query).set(tokens.ana))
            .body,
        )
        .data.map(({ takenAt }) => takenAt.slice(0, 7));

    expect(await list({ tag: 'TEORIA' })).toEqual(['2024-03', '2024-01']);
    expect(await list({ authorId: users.ana.id })).toEqual(['2024-01']);
    expect(await list({ from: '2024-02-01', to: '2024-02-28' })).toEqual(['2024-02']);
    expect(await list({ analysisStatus: 'DONE' })).toEqual([]);
  });

  it('answers 403 to non-members of a non-public Space', async () => {
    const { app, space, tokens } = await scenario();

    const response = await request(app).get(`/api/spaces/${space.id}/snaps`).set(tokens.out);

    expect(response.status).toBe(403);
  });
});

describe('one snap: GET, PATCH and DELETE /api/snaps/:id', () => {
  async function uploadedBy(context: Awaited<ReturnType<typeof scenario>>, who: 'ana' | 'leo') {
    const response = await request(context.app)
      .post(context.uploadUrl)
      .set(context.tokens[who])
      .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const [snap] = snapListSchema.parse(response.body).data;
    if (snap === undefined) throw new Error('No snap uploaded');
    return snap;
  }

  it('returns the snap with signed URLs of the image and the thumbnail', async () => {
    const context = await scenario();
    const snap = await uploadedBy(context, 'leo');

    const response = await request(context.app)
      .get(`/api/snaps/${snap.id}`)
      .set(context.tokens.sol);
    const outsider = await request(context.app)
      .get(`/api/snaps/${snap.id}`)
      .set(context.tokens.out);
    const unknown = await request(context.app)
      .get('/api/snaps/0196f3a2-0000-7000-8000-000000000000')
      .set(context.tokens.ana);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: { id: snap.id, imageUrl: expect.stringMatching(/^file:\/\//) as string },
    });
    expect(outsider.status).toBe(403);
    expect(unknown.status).toBe(404);
  });

  it('lets the author and OWNERs change the note and tags, and nobody else', async () => {
    const context = await scenario();
    const snap = await uploadedBy(context, 'leo');
    const editors = await createUser(prisma, { username: 'other_editor' });
    await addMember(prisma, context.space.id, editors.id, 'EDITOR');
    const otherEditor = bearer((await signIn(context.app, 'other_editor')).accessToken);

    const byAuthor = await request(context.app)
      .patch(`/api/snaps/${snap.id}`)
      .set(context.tokens.leo)
      .send({ note: 'Fórmulas', tags: ['Derivadas', 'derivadas'] });
    const byOwner = await request(context.app)
      .patch(`/api/snaps/${snap.id}`)
      .set(context.tokens.ana)
      .send({ note: '' });
    const byOtherEditor = await request(context.app)
      .patch(`/api/snaps/${snap.id}`)
      .set(otherEditor)
      .send({ note: 'mine' });

    expect(byAuthor.body).toMatchObject({ data: { note: 'Fórmulas', tags: ['derivadas'] } });
    expect(byOwner.body).toMatchObject({ data: { note: null } });
    expect(byOtherEditor.status).toBe(403);
  });

  it('deletes the snap from the database and its files from storage', async () => {
    const context = await scenario();
    const snap = await uploadedBy(context, 'leo');
    const stored = await prisma.snap.findUniqueOrThrow({ where: { id: snap.id } });

    const byViewer = await request(context.app)
      .delete(`/api/snaps/${snap.id}`)
      .set(context.tokens.sol);
    const byAuthor = await request(context.app)
      .delete(`/api/snaps/${snap.id}`)
      .set(context.tokens.leo);

    expect(byViewer.status).toBe(403);
    expect(byAuthor.status).toBe(204);
    expect(await prisma.snap.findUnique({ where: { id: snap.id } })).toBeNull();
    await expect(storage.getBuffer(stored.storageKey)).rejects.toThrow();
    await expect(storage.getBuffer(stored.thumbnailKey)).rejects.toThrow();
  });
});
