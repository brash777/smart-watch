import { randomUUID } from 'node:crypto';
import {
  snapAnalysisStateSchema,
  snapInsightSchema,
  spaceAnalysisStatusSchema,
} from '@snapia/shared';
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
const insightResponseSchema = z.object({ data: snapInsightSchema });
const uploadResponseSchema = z.object({ data: z.array(z.object({ id: z.uuid() })) });
const invalidOutput = { summary: '' };

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

/**
 * ana owns a MEMBERS STUDY Space with leo and max as EDITORs and sol as VIEWER; out is not a
 * member. The AI queue is running, with the mock provider.
 */
async function scenario() {
  context = createDatabaseTestContext({}, { storage, aiProvider: provider });
  const { app, aiQueue } = context;
  const users = {
    ana: await createUser(prisma, { username: 'ana' }),
    leo: await createUser(prisma, { username: 'leo' }),
    max: await createUser(prisma, { username: 'max' }),
    sol: await createUser(prisma, { username: 'sol' }),
    out: await createUser(prisma, { username: 'out' }),
  };
  const space = await createSpace(prisma, users.ana.id, { mode: 'STUDY', visibility: 'MEMBERS' });
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

  /** A snap uploaded by leo, once its analysis is over. */
  async function analyzedSnap(): Promise<string> {
    const response = await request(app)
      .post(`/api/spaces/${space.id}/snaps`)
      .set(tokens.leo)
      .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);
    await aiQueue.onIdle();
    const [snap] = uploadResponseSchema.parse(response.body).data;
    if (snap === undefined) throw new Error('No snap uploaded');
    return snap.id;
  }

  /** A snap whose analysis failed, so it has no insight. */
  async function failedSnap(): Promise<string> {
    provider.queueReplies(
      { type: 'toolCall', input: invalidOutput },
      { type: 'toolCall', input: invalidOutput },
    );
    return analyzedSnap();
  }

  function setStatus(snapId: string, analysisStatus: 'PENDING' | 'PROCESSING' | 'FAILED') {
    return prisma.snap.update({ where: { id: snapId }, data: { analysisStatus } });
  }

  return { app, aiQueue, users, space, tokens, analyzedSnap, failedSnap, setStatus };
}

describe('GET /api/snaps/:id/insight', () => {
  it('returns the insight to every member', async () => {
    const { app, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();

    for (const token of [tokens.ana, tokens.leo, tokens.sol]) {
      const response = await request(app).get(`/api/snaps/${snapId}/insight`).set(token);

      expect(response.status).toBe(200);
      const { data } = insightResponseSchema.parse(response.body);
      expect(data).toMatchObject({
        snapId,
        mode: 'STUDY',
        promptVersion: 'snap-analysis.study.v1',
        editedByUser: false,
      });
      expect(data.mode === 'STUDY' && data.data.extractedText).toContain('La célula animal');
    }
  });

  it('is public in a PUBLIC Space', async () => {
    const { app, space, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    await prisma.space.update({ where: { id: space.id }, data: { visibility: 'PUBLIC' } });

    expect((await request(app).get(`/api/snaps/${snapId}/insight`)).status).toBe(200);
  });

  it('answers 404 INSIGHT_NOT_FOUND, with the analysis status, while there is no insight', async () => {
    const { app, tokens, failedSnap } = await scenario();
    const snapId = await failedSnap();

    const response = await request(app).get(`/api/snaps/${snapId}/insight`).set(tokens.sol);

    expect(response.status).toBe(404);
    expect(readError(response.body)).toMatchObject({
      code: 'INSIGHT_NOT_FOUND',
      details: { analysisStatus: 'FAILED' },
    });
  });

  it('answers 401, 403, 404 and 400 like the snap itself', async () => {
    const { app, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    const get = (id: string, token: Record<string, string> = {}) =>
      request(app).get(`/api/snaps/${id}/insight`).set(token);

    expect((await get(snapId)).status).toBe(401);
    expect((await get(snapId, tokens.out)).status).toBe(403);
    expect(readError((await get(randomUUID(), tokens.ana)).body).code).toBe('SNAP_NOT_FOUND');
    expect(readError((await get('not-a-uuid', tokens.ana)).body).code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/snaps/:id/insight', () => {
  it('lets the author change some fields and keeps the others', async () => {
    const { app, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    const before = insightResponseSchema.parse(
      (await request(app).get(`/api/snaps/${snapId}/insight`).set(tokens.leo)).body,
    ).data;

    const response = await request(app)
      .patch(`/api/snaps/${snapId}/insight`)
      .set(tokens.leo)
      .send({ summary: '  Mi resumen de la clase.  ', suggestedTags: ['Parcial', 'parcial'] });

    expect(response.status).toBe(200);
    const { data } = insightResponseSchema.parse(response.body);
    expect(data.editedByUser).toBe(true);
    expect(data.data).toEqual({
      ...before.data,
      summary: 'Mi resumen de la clase.',
      suggestedTags: ['parcial'],
    });
    const stored = await prisma.snapInsight.findUniqueOrThrow({ where: { snapId } });
    expect(stored).toMatchObject({ summary: 'Mi resumen de la clase.', editedByUser: true });
  });

  it('checks the body against the mode of the insight', async () => {
    const { app, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    const patch = (body: unknown) =>
      request(app)
        .patch(`/api/snaps/${snapId}/insight`)
        .set(tokens.leo)
        .send(body as object);

    const otherMode = await patch({ qualityScore: 50 });
    const emptySummary = await patch({ summary: ' ' });
    const nothing = await patch({});
    const notAnObject = await patch(['summary']);

    for (const response of [otherMode, emptySummary, nothing, notAnObject]) {
      expect(response.status).toBe(400);
      expect(readError(response.body).code).toBe('VALIDATION_ERROR');
    }
    expect(readError(emptySummary.body).details).toEqual([
      expect.objectContaining({ path: 'body.summary' }),
    ]);
    expect(readError(otherMode.body).details).toContainEqual(
      expect.objectContaining({ path: 'body', code: 'unrecognized_keys' }),
    );
  });

  it('only lets the author (EDITOR or more) or an OWNER change the insight', async () => {
    const { app, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    const patch = (token: Record<string, string>) =>
      request(app).patch(`/api/snaps/${snapId}/insight`).set(token).send({ summary: 'Otro.' });

    expect((await patch({})).status).toBe(401);
    expect((await patch(tokens.sol)).status).toBe(403);
    expect((await patch(tokens.max)).status).toBe(403);
    expect((await patch(tokens.out)).status).toBe(403);
    expect((await patch(tokens.ana)).status).toBe(200);
  });

  it('answers 409 while the snap is being analyzed and 404 when it has no insight', async () => {
    const { app, tokens, analyzedSnap, failedSnap, setStatus } = await scenario();
    const analyzing = await analyzedSnap();
    await setStatus(analyzing, 'PROCESSING');
    const failed = await failedSnap();
    const patch = (snapId: string) =>
      request(app).patch(`/api/snaps/${snapId}/insight`).set(tokens.leo).send({ summary: 'Otro.' });

    expect(readError((await patch(analyzing)).body).code).toBe('ANALYSIS_IN_PROGRESS');
    expect(readError((await patch(failed)).body).code).toBe('INSIGHT_NOT_FOUND');
  });
});

describe('POST /api/snaps/:id/reanalyze', () => {
  it('analyzes a FAILED snap again, recording the AiRun for whoever asked', async () => {
    const { app, aiQueue, users, tokens, failedSnap } = await scenario();
    const snapId = await failedSnap();

    const response = await request(app).post(`/api/snaps/${snapId}/reanalyze`).set(tokens.ana);
    await aiQueue.onIdle();

    expect(response.status).toBe(202);
    expect(z.object({ data: snapAnalysisStateSchema }).parse(response.body).data).toEqual({
      snapId,
      analysisStatus: 'PENDING',
    });
    const snap = await prisma.snap.findUniqueOrThrow({
      where: { id: snapId },
      include: { insight: true },
    });
    expect(snap.analysisStatus).toBe('DONE');
    const run = await prisma.aiRun.findFirstOrThrow({ where: { id: snap.insight?.aiRunId ?? '' } });
    expect(run.userId).toBe(users.ana.id);
  });

  it('keeps the current insight when the new analysis fails', async () => {
    const { app, aiQueue, tokens, analyzedSnap } = await scenario();
    const snapId = await analyzedSnap();
    provider.queueReplies(
      { type: 'toolCall', input: invalidOutput },
      { type: 'toolCall', input: invalidOutput },
    );

    await request(app).post(`/api/snaps/${snapId}/reanalyze`).set(tokens.leo).expect(202);
    await aiQueue.onIdle();

    expect((await prisma.snap.findUniqueOrThrow({ where: { id: snapId } })).analysisStatus).toBe(
      'FAILED',
    );
    expect((await request(app).get(`/api/snaps/${snapId}/insight`).set(tokens.leo)).status).toBe(
      200,
    );
  });

  it('answers 409 while the snap is PENDING or PROCESSING', async () => {
    const { app, tokens, analyzedSnap, setStatus } = await scenario();
    const snapId = await analyzedSnap();

    for (const status of ['PENDING', 'PROCESSING'] as const) {
      await setStatus(snapId, status);
      const response = await request(app).post(`/api/snaps/${snapId}/reanalyze`).set(tokens.leo);

      expect(response.status).toBe(409);
      expect(readError(response.body).code).toBe('ANALYSIS_IN_PROGRESS');
    }
  });

  it('needs a session and the right to change the snap', async () => {
    const { app, tokens, failedSnap } = await scenario();
    const snapId = await failedSnap();
    const reanalyze = (token: Record<string, string>) =>
      request(app).post(`/api/snaps/${snapId}/reanalyze`).set(token);

    expect((await reanalyze({})).status).toBe(401);
    expect((await reanalyze(tokens.sol)).status).toBe(403);
    expect((await reanalyze(tokens.max)).status).toBe(403);
    expect((await reanalyze(tokens.out)).status).toBe(403);
    expect(
      readError(
        (await request(app).post(`/api/snaps/${randomUUID()}/reanalyze`).set(tokens.ana)).body,
      ).code,
    ).toBe('SNAP_NOT_FOUND');
  });
});

describe('GET /api/spaces/:spaceId/analysis-status', () => {
  it('counts the snaps of the Space in each status and says when to ask again', async () => {
    const { app, space, tokens, analyzedSnap, setStatus } = await scenario();
    await analyzedSnap();
    await setStatus(await analyzedSnap(), 'PENDING');
    await setStatus(await analyzedSnap(), 'FAILED');
    const pollInterval = await prisma.appSetting.findUniqueOrThrow({
      where: { key: 'analysis_poll_interval_ms' },
    });

    const response = await request(app)
      .get(`/api/spaces/${space.id}/analysis-status`)
      .set(tokens.sol);

    expect(response.status).toBe(200);
    expect(z.object({ data: spaceAnalysisStatusSchema }).parse(response.body).data).toEqual({
      spaceId: space.id,
      total: 3,
      counts: { PENDING: 1, PROCESSING: 0, DONE: 1, FAILED: 1 },
      pollIntervalMs: pollInterval.value,
    });
  });

  it('follows the access rules of the Space', async () => {
    const { app, space, tokens } = await scenario();
    const get = (spaceId: string, token: Record<string, string> = {}) =>
      request(app).get(`/api/spaces/${spaceId}/analysis-status`).set(token);

    expect((await get(space.id)).status).toBe(401);
    expect((await get(space.id, tokens.out)).status).toBe(403);
    expect(readError((await get(randomUUID(), tokens.ana)).body).code).toBe('SPACE_NOT_FOUND');

    await prisma.space.update({ where: { id: space.id }, data: { visibility: 'PUBLIC' } });
    expect((await get(space.id)).status).toBe(200);
  });
});
