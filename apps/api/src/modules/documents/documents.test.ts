import { randomUUID } from 'node:crypto';
import { documentSchema, documentSummarySchema, type SpaceMode } from '@snapia/shared';
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
const documentResponseSchema = z.object({ data: documentSchema });
const documentListSchema = z.object({
  data: z.array(documentSummarySchema),
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

/**
 * ana owns a MEMBERS STUDY Space with leo and max as EDITORs and sol as VIEWER; out is not a
 * member. leo uploaded three snaps, taken on May 3, 1 and 2, and they are analyzed.
 */
async function scenario() {
  context = createDatabaseTestContext({}, { storage, aiProvider: provider });
  const { app, aiQueue } = context;
  const users = {
    ana: await createUser(prisma, { username: 'ana', name: 'Ana Rivas' }),
    leo: await createUser(prisma, { username: 'leo', name: 'Leo Gómez' }),
    max: await createUser(prisma, { username: 'max' }),
    sol: await createUser(prisma, { username: 'sol' }),
    out: await createUser(prisma, { username: 'out' }),
  };
  const space = await createSpace(prisma, users.ana.id, {
    mode: 'STUDY',
    visibility: 'MEMBERS',
    metadata: { subject: 'Cálculo II' },
  });
  await addMember(prisma, space.id, users.leo.id, 'EDITOR');
  await addMember(prisma, space.id, users.max.id, 'EDITOR');
  await addMember(prisma, space.id, users.sol.id, 'VIEWER');
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    max: bearer((await signIn(app, 'max')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
    out: bearer((await signIn(app, 'out')).accessToken),
  };
  await aiQueue.start();

  async function uploadSnaps(spaceId: string, token: { Authorization: string }, days: string[]) {
    let upload = request(app).post(`/api/spaces/${spaceId}/snaps`).set(token);
    for (const [index, takenOn] of days.entries()) {
      upload = upload.attach('files', await createTestJpeg({ takenAt: `${takenOn} 10:30:00` }), {
        filename: `board-${String(index)}.jpg`,
        contentType: 'image/jpeg',
      });
    }
    const response = await upload.expect(201);
    await aiQueue.onIdle();
    return uploadResponseSchema.parse(response.body).data.map(({ id }) => id);
  }

  const [may3, may1, may2] = await uploadSnaps(space.id, tokens.leo, [
    '2024:05:03',
    '2024:05:01',
    '2024:05:02',
  ]);
  if (may1 === undefined || may2 === undefined || may3 === undefined) throw new Error('No snaps');

  /** A Space of another mode owned by ana, with two analyzed snaps. */
  async function otherModeSpace(mode: SpaceMode, metadata: Record<string, string>) {
    const other = await createSpace(prisma, users.ana.id, { mode, metadata });
    const snapIds = await uploadSnaps(other.id, tokens.ana, ['2024:06:01', '2024:06:04']);
    return { space: other, snapIds };
  }

  return {
    app,
    users,
    space,
    tokens,
    snaps: { may1, may2, may3 },
    composeUrl: `/api/spaces/${space.id}/documents`,
    otherModeSpace,
  };
}

describe('POST /api/spaces/:spaceId/documents (Compose)', () => {
  it('drafts STUDY_NOTES from the insights, numbered by date, and stores the sources', async () => {
    const { app, users, tokens, snaps, composeUrl } = await scenario();
    const callsBefore = provider.calls.length;

    const response = await request(app)
      .post(composeUrl)
      .set(tokens.leo)
      .send({
        type: 'STUDY_NOTES',
        snapIds: [snaps.may3, snaps.may1, snaps.may2],
        instructions: 'Enfócate en los ejemplos.',
      });

    expect(response.status).toBe(201);
    const { data } = documentResponseSchema.parse(response.body);
    expect(data).toMatchObject({
      type: 'STUDY_NOTES',
      title: 'Apuntes: diagrama de clases del sistema de venta de productos',
      status: 'DRAFT',
      version: 1,
      promptVersion: 'compose.study-notes.v1',
      instructions: 'Enfócate en los ejemplos.',
      author: { username: 'leo' },
    });
    expect(data.contentMarkdown).toContain('[Snap 1]');
    expect(data.sources).toEqual([
      { snapId: snaps.may1, order: 1 },
      { snapId: snaps.may2, order: 2 },
      { snapId: snaps.may3, order: 3 },
    ]);
    expect(await prisma.documentSource.count({ where: { documentId: data.id } })).toBe(3);

    const run = await prisma.aiRun.findFirstOrThrow({ where: { task: 'COMPOSE_DOCUMENT' } });
    expect(run).toMatchObject({
      status: 'COMPLETED',
      userId: users.leo.id,
      promptVersion: 'compose.study-notes.v1',
      input: { type: 'STUDY_NOTES', snapIds: [snaps.may1, snaps.may2, snaps.may3] },
    });

    const call = provider.calls[callsBefore];
    expect(call?.request).toMatchObject({ promptName: 'compose.study-notes', images: [] });
    const text = call?.request.text ?? '';
    const order = ['2024-05-01', '2024-05-02', '2024-05-03'].map((date) => text.indexOf(date));
    expect(order.every((position) => position > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const expected of ['### [Snap 3]', 'Member 1', 'subject: Cálculo II', 'ejemplos']) {
      expect(text).toContain(expected);
    }
    for (const personal of ['Leo Gómez', 'Ana Rivas', 'leo@example.com']) {
      expect(text).not.toContain(personal);
    }
  });

  it('answers 400 when the type is not one of the Space mode', async () => {
    const { app, tokens, snaps, composeUrl } = await scenario();

    const otherMode = await request(app)
      .post(composeUrl)
      .set(tokens.leo)
      .send({ type: 'WORK_DAILY_REPORT', snapIds: [snaps.may1] });
    const unknown = await request(app)
      .post(composeUrl)
      .set(tokens.leo)
      .send({ type: 'ESSAY', snapIds: [snaps.may1] });

    expect(otherMode.status).toBe(400);
    expect(readError(otherMode.body)).toMatchObject({
      code: 'DOCUMENT_TYPE_NOT_ALLOWED',
      details: {
        mode: 'STUDY',
        allowedTypes: ['STUDY_NOTES', 'STUDY_SUMMARY', 'ASSIGNMENT_GUIDE'],
      },
    });
    expect(unknown.status).toBe(400);
    expect(readError(unknown.body).code).toBe('VALIDATION_ERROR');
  });

  it('needs the statement of an ASSIGNMENT_GUIDE and opens the guide with the notice', async () => {
    const { app, tokens, snaps, composeUrl } = await scenario();
    const body = { type: 'ASSIGNMENT_GUIDE', snapIds: [snaps.may1, snaps.may2] };

    const withoutStatement = await request(app).post(composeUrl).set(tokens.leo).send(body);
    const withStatement = await request(app)
      .post(composeUrl)
      .set(tokens.leo)
      .send({
        ...body,
        instructions: 'Ensayo sobre el diseño orientado a objetos del sistema de venta.',
      });

    expect(readError(withoutStatement.body).code).toBe('INSTRUCTIONS_REQUIRED');
    expect(withStatement.status).toBe(201);
    const notice = String(await settingValue('assignment_guide_notice'));
    expect(documentResponseSchema.parse(withStatement.body).data.contentMarkdown).toMatch(
      new RegExp(`^> ${notice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n\n## Esquema propuesto`),
    );
  });

  it('only uses analyzed snaps of the Space, at most max_snaps_per_compose', async () => {
    const { app, tokens, snaps, composeUrl, otherModeSpace } = await scenario();
    // Before the first read: the settings service caches what it reads.
    await prisma.appSetting.update({ where: { key: 'max_snaps_per_compose' }, data: { value: 2 } });
    const compose = (snapIds: string[]) =>
      request(app).post(composeUrl).set(tokens.ana).send({ type: 'STUDY_SUMMARY', snapIds });
    const other = await otherModeSpace('WORK', {});

    const foreign = await compose([snaps.may1, other.snapIds[0] ?? '']);
    await prisma.snap.update({ where: { id: snaps.may2 }, data: { analysisStatus: 'PENDING' } });
    const pending = await compose([snaps.may1, snaps.may2]);
    const tooMany = await compose([snaps.may1, snaps.may2, snaps.may3]);
    const none = await compose([]);

    expect(foreign.status).toBe(404);
    expect(readError(foreign.body)).toMatchObject({
      code: 'SNAP_NOT_FOUND',
      details: { snapIds: [other.snapIds[0]] },
    });
    expect(pending.status).toBe(409);
    expect(readError(pending.body)).toMatchObject({
      code: 'SNAPS_NOT_ANALYZED',
      details: { snapIds: [snaps.may2] },
    });
    expect(readError(tooMany.body)).toMatchObject({
      code: 'TOO_MANY_SNAPS',
      details: { limit: 2 },
    });
    expect(readError(none.body).code).toBe('VALIDATION_ERROR');
    expect(await prisma.document.count()).toBe(0);
  });

  it('asks again when the draft cites a snap that was not sent', async () => {
    const { app, tokens, snaps, composeUrl } = await scenario();
    provider.queueReplies({
      type: 'toolCall',
      input: { title: 'Apuntes', contentMarkdown: 'Ver [Snap 9].' },
    });

    const response = await request(app)
      .post(composeUrl)
      .set(tokens.leo)
      .send({ type: 'STUDY_SUMMARY', snapIds: [snaps.may1, snaps.may2] });

    expect(response.status).toBe(201);
    const runs = await prisma.aiRun.findMany({
      where: { task: 'COMPOSE_DOCUMENT' },
      orderBy: { createdAt: 'asc' },
    });
    expect(runs.map(({ status }) => status)).toEqual(['FAILED', 'COMPLETED']);
    expect(provider.calls.at(-1)?.correction).toContain('[Snap 9] does not exist');
  });

  it.each([
    ['WORK', 'WORK_PROGRESS_REPORT', { project: 'Torre B' }, '2024-06-01 to 2024-06-04'],
    ['CONTENT', 'CONTENT_POST', { niche: 'repostería' }, '#snapia'],
  ] as const)('composes in a %s Space with its own prompt', async (mode, type, metadata, line) => {
    const { app, tokens, otherModeSpace } = await scenario();
    const other = await otherModeSpace(mode, metadata);

    const response = await request(app)
      .post(`/api/spaces/${other.space.id}/documents`)
      .set(tokens.ana)
      .send({ type, snapIds: other.snapIds });

    expect(response.status).toBe(201);
    const promptName = `compose.${type.toLowerCase().replaceAll('_', '-')}`;
    const call = provider.calls.at(-1);
    expect(call?.request.promptName).toBe(promptName);
    if (type === 'CONTENT_POST') {
      const hashtags = z.array(z.string()).parse(await settingValue('default_hashtags'));
      expect(call?.request.text).toContain(hashtags.map((tag) => `#${tag}`).join(' '));
    } else {
      expect(call?.request.text).toContain(line);
    }
  });

  it('is for EDITORs and OWNERs', async () => {
    const { app, tokens, snaps, composeUrl } = await scenario();
    const compose = (token: Record<string, string>) =>
      request(app)
        .post(composeUrl)
        .set(token)
        .send({ type: 'STUDY_SUMMARY', snapIds: [snaps.may1] });

    expect((await compose({})).status).toBe(401);
    expect((await compose(tokens.sol)).status).toBe(403);
    expect((await compose(tokens.out)).status).toBe(403);
    expect((await compose(tokens.ana)).status).toBe(201);
  });
});

describe('Documents: list, read, edit and delete', () => {
  async function withDocument() {
    const context = await scenario();
    const response = await request(context.app)
      .post(context.composeUrl)
      .set(context.tokens.leo)
      .send({ type: 'STUDY_NOTES', snapIds: [context.snaps.may1, context.snaps.may2] });
    const document = documentResponseSchema.parse(response.body).data;
    return { ...context, document, documentUrl: `/api/documents/${document.id}` };
  }

  it('lists the Documents of a Space for its members, newest first', async () => {
    const { app, tokens, composeUrl, snaps } = await withDocument();
    await request(app)
      .post(composeUrl)
      .set(tokens.ana)
      .send({ type: 'STUDY_SUMMARY', snapIds: [snaps.may3] })
      .expect(201);

    const all = documentListSchema.parse(
      (await request(app).get(composeUrl).set(tokens.sol).expect(200)).body,
    );
    const summaries = documentListSchema.parse(
      (await request(app).get(composeUrl).query({ type: 'STUDY_SUMMARY' }).set(tokens.sol)).body,
    );

    expect(all.data.map(({ type }) => type)).toEqual(['STUDY_SUMMARY', 'STUDY_NOTES']);
    expect(all.meta.nextCursor).toBeNull();
    expect(summaries.data).toHaveLength(1);
    expect((await request(app).get(composeUrl).set(tokens.out)).status).toBe(403);
  });

  it('shows a Document to the members of its Space', async () => {
    const { app, tokens, document, documentUrl } = await withDocument();

    const response = await request(app).get(documentUrl).set(tokens.sol);

    expect(response.status).toBe(200);
    expect(documentResponseSchema.parse(response.body).data).toEqual(document);
    expect((await request(app).get(documentUrl)).status).toBe(401);
    expect((await request(app).get(documentUrl).set(tokens.out)).status).toBe(403);
    expect(
      readError((await request(app).get(`/api/documents/${randomUUID()}`).set(tokens.ana)).body)
        .code,
    ).toBe('DOCUMENT_NOT_FOUND');
  });

  it('lets the author edit the Markdown, as a new version', async () => {
    const { app, tokens, documentUrl } = await withDocument();

    const response = await request(app)
      .patch(documentUrl)
      .set(tokens.leo)
      .send({ contentMarkdown: '## Mis apuntes\n\nTexto revisado [Snap 1].', status: 'FINAL' });

    expect(response.status).toBe(200);
    expect(documentResponseSchema.parse(response.body).data).toMatchObject({
      contentMarkdown: '## Mis apuntes\n\nTexto revisado [Snap 1].',
      status: 'FINAL',
      version: 2,
    });
    const empty = await request(app).patch(documentUrl).set(tokens.leo).send({});
    expect(readError(empty.body).code).toBe('VALIDATION_ERROR');
  });

  it('only lets the author (EDITOR or more) or an OWNER edit or delete', async () => {
    const { app, tokens, documentUrl } = await withDocument();
    const edit = (token: Record<string, string>) =>
      request(app).patch(documentUrl).set(token).send({ title: 'Otro título' });

    expect((await edit({})).status).toBe(401);
    expect((await edit(tokens.max)).status).toBe(403);
    expect((await edit(tokens.sol)).status).toBe(403);
    expect((await request(app).delete(documentUrl).set(tokens.max)).status).toBe(403);
    expect((await edit(tokens.ana)).status).toBe(200);

    expect((await request(app).delete(documentUrl).set(tokens.ana)).status).toBe(204);
    expect((await request(app).get(documentUrl).set(tokens.ana)).status).toBe(404);
    expect(await prisma.documentSource.count()).toBe(0);
  });
});

describe('GET /api/documents/:id/export', () => {
  async function withNotes() {
    const context = await scenario();
    const response = await request(context.app)
      .post(context.composeUrl)
      .set(context.tokens.leo)
      .send({ type: 'STUDY_NOTES', snapIds: [context.snaps.may1, context.snaps.may2] });
    const document = documentResponseSchema.parse(response.body).data;
    return { ...context, document, exportUrl: `/api/documents/${document.id}/export` };
  }

  it('downloads the Markdown with the title on top', async () => {
    const { app, tokens, document, exportUrl } = await withNotes();

    const response = await request(app).get(exportUrl).query({ format: 'md' }).set(tokens.sol);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename=apuntes-diagrama-de-clases-del-sistema-de-venta-de-productos.md',
    );
    expect(response.text).toBe(`# ${document.title}\n\n${document.contentMarkdown}\n`);
  });

  it('downloads a PDF that is not empty', async () => {
    const { app, tokens, exportUrl } = await withNotes();

    const response = await request(app)
      .get(exportUrl)
      .query({ format: 'pdf' })
      .set(tokens.sol)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          callback(null, Buffer.concat(chunks));
        });
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename=apuntes-diagrama-de-clases-del-sistema-de-venta-de-productos.pdf',
    );
    const pdf = response.body as Buffer;
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.includes(`(${createTestConfig().app.name})`)).toBe(true);
  });

  it('needs a known format and access to the Space', async () => {
    const { app, tokens, exportUrl } = await withNotes();
    const download = (token: Record<string, string>, format = 'pdf') =>
      request(app).get(exportUrl).query({ format }).set(token);

    expect(readError((await download(tokens.ana, 'docx')).body).code).toBe('VALIDATION_ERROR');
    expect((await download({})).status).toBe(401);
    expect((await download(tokens.out)).status).toBe(403);
    expect(
      readError(
        (await request(app).get(`/api/documents/${randomUUID()}/export?format=md`).set(tokens.ana))
          .body,
      ).code,
    ).toBe('DOCUMENT_NOT_FOUND');
  });
});
