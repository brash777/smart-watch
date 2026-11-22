import { snapInsightDataSchemas, type SpaceMode } from '@snapia/shared';
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
import type { TestApp } from '../../../test/test-app';
import { createTestConfig } from '../../../test/test-config';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createTestStorage } from '../../../test/test-storage';
import type { StorageProvider } from '../../lib/storage';
import { AiProviderError } from './ai-provider';
import { createMockAiProvider, type MockAiProvider } from './providers/mock-ai-provider';

const prisma = getTestPrisma();
const config = createTestConfig();
const uploadResponseSchema = z.object({ data: z.array(z.object({ id: z.uuid() })) });

let storage: StorageProvider;
let cleanupStorage: () => Promise<void>;
let provider: MockAiProvider;
let contexts: TestApp[];

beforeEach(async () => {
  await resetTestDatabase();
  ({ storage, cleanup: cleanupStorage } = await createTestStorage());
  provider = createMockAiProvider({ model: config.ai.model });
  contexts = [];
});
afterEach(async () => {
  // No analysis may outlive its test: drop what is queued and wait for what is running.
  for (const { aiQueue } of contexts) aiQueue.stop();
  await Promise.all(contexts.map(({ aiQueue }) => aiQueue.onIdle()));
  await cleanupStorage();
});
afterAll(disconnectTestPrisma);

function newContext(): TestApp {
  const context = createDatabaseTestContext({}, { storage, aiProvider: provider });
  contexts.push(context);
  return context;
}

/** ana_rivas owns a Space of the given mode. The AI queue is paused until start(). */
async function scenario(mode: SpaceMode = 'STUDY', metadata: Record<string, string> = {}) {
  const context = newContext();
  const ana = await createUser(prisma, {
    username: 'ana_rivas',
    name: 'Ana Rivas',
    email: 'ana.rivas@example.com',
  });
  const space = await createSpace(prisma, ana.id, { mode, metadata });
  const token = bearer((await signIn(context.app, 'ana_rivas')).accessToken);
  return { ...context, ana, space, token };
}

async function uploadSnap(
  { app, token, space }: Awaited<ReturnType<typeof scenario>>,
  fields: { note?: string; tags?: string } = {},
): Promise<string> {
  let upload = request(app).post(`/api/spaces/${space.id}/snaps`).set(token);
  if (fields.note !== undefined) upload = upload.field('note', fields.note);
  if (fields.tags !== undefined) upload = upload.field('tags', fields.tags);
  const response = await upload
    .attach('files', await createTestJpeg({ width: 64, height: 48 }), {
      filename: 'board.jpg',
      contentType: 'image/jpeg',
    })
    .expect(201);
  const [snap] = uploadResponseSchema.parse(response.body).data;
  if (snap === undefined) throw new Error('No snap uploaded');
  return snap.id;
}

async function settingValue(key: string): Promise<unknown> {
  return (await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value;
}

const invalidOutput = { summary: '' };

describe('background snap analysis', () => {
  it('turns a new STUDY snap into a DONE snap with its SnapInsight and AiRun', async () => {
    const context = await scenario('STUDY');
    const snapId = await uploadSnap(context, { note: 'Clase 3', tags: 'parcial' });

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    const snap = await prisma.snap.findUniqueOrThrow({
      where: { id: snapId },
      include: { insight: true },
    });
    const [run] = await prisma.aiRun.findMany();
    expect(snap.analysisStatus).toBe('DONE');
    const data = snapInsightDataSchemas.STUDY.parse(snap.insight?.data);
    expect(snap.insight).toMatchObject({
      mode: 'STUDY',
      summary: data.summary,
      extractedText: data.extractedText,
      promptVersion: 'snap-analysis.study.v1',
      aiRunId: run?.id,
      editedByUser: false,
    });
    expect(run).toMatchObject({
      task: 'SNAP_ANALYSIS',
      status: 'COMPLETED',
      userId: context.ana.id,
      spaceId: context.space.id,
      promptVersion: 'snap-analysis.study.v1',
      input: { snapId, mode: 'STUDY' },
    });
    expect(run?.inputTokens).toBeGreaterThan(0);
    expect(Number(run?.estimatedCost)).toBeGreaterThan(0);

    const insight = await request(context.app)
      .get(`/api/snaps/${snapId}/insight`)
      .set(context.token)
      .expect(200);
    expect(insight.body).toMatchObject({
      data: { mode: 'STUDY', data: { extractedText: data.extractedText } },
    });
  });

  it('sends the resized photo and its context, but no personal data', async () => {
    const context = await scenario('STUDY', {
      subject: 'Cálculo II',
      professor: 'Dr. Julián Gómez',
      semester: '2026-1',
    });
    await uploadSnap(context, {
      note: 'Dudas: escribir a profe.calculo@example.com o al 300 123 4567',
      tags: 'parcial, derivadas',
    });

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    expect(provider.calls).toHaveLength(1);
    const sent = provider.calls[0]?.request;
    expect(sent).toMatchObject({
      promptName: 'snap-analysis.study',
      effort: config.ai.snapAnalysis.effort,
      speed: config.ai.snapAnalysis.speed,
      tool: { name: 'save_snap_insight', inputSchema: { additionalProperties: false } },
    });
    expect(sent?.images).toHaveLength(1);
    const [image] = sent?.images ?? [];
    expect(image?.mediaType).toBe(`image/${config.ai.image.format}`);
    expect(Math.max(image?.width ?? 0, image?.height ?? 0)).toBeLessThanOrEqual(
      config.ai.image.maxSidePx,
    );

    const text = sent?.text ?? '';
    expect(text).toContain(`\`${String(await settingValue('ai_output_language'))}\``);
    for (const context of ['subject: Cálculo II', 'semester: 2026-1', 'parcial, derivadas']) {
      expect(text).toContain(context);
    }
    expect(text).toContain('Dudas: escribir a [email] o al [phone]');
    for (const personal of [
      'profe.calculo@example.com',
      '300 123 4567',
      'Gómez',
      'Ana Rivas',
      'ana_rivas',
      'ana.rivas@example.com',
    ]) {
      expect(text).not.toContain(personal);
    }
  });

  it.each([
    ['WORK', { project: 'Torre B', siteLabel: 'Cuarto técnico' }, 'project: Torre B'],
    ['CONTENT', { niche: 'repostería' }, 'niche: repostería'],
  ] as const)('uses the prompt and the output of a %s Space', async (mode, metadata, line) => {
    const context = await scenario(mode, metadata);
    const snapId = await uploadSnap(context);

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    const sent = provider.calls[0]?.request;
    expect(sent?.promptName).toBe(`snap-analysis.${mode.toLowerCase()}`);
    expect(sent?.text).toContain(line);
    if (mode === 'CONTENT') {
      expect(sent?.text).toContain(String(await settingValue('content_caption_tone')));
    }
    const insight = await prisma.snapInsight.findUniqueOrThrow({ where: { snapId } });
    expect(insight).toMatchObject({
      mode,
      extractedText: null,
      promptVersion: `snap-analysis.${mode.toLowerCase()}.v1`,
    });
    expect(snapInsightDataSchemas[mode].safeParse(insight.data).success).toBe(true);
  });

  it('leaves the snap FAILED, without insight, when the AI output stays invalid', async () => {
    const context = await scenario('STUDY');
    provider.queueReplies(
      { type: 'toolCall', input: invalidOutput },
      { type: 'toolCall', input: invalidOutput },
    );
    const snapId = await uploadSnap(context);

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    const snap = await prisma.snap.findUniqueOrThrow({
      where: { id: snapId },
      include: { insight: true },
    });
    expect(snap.analysisStatus).toBe('FAILED');
    expect(snap.insight).toBeNull();
    const runs = await prisma.aiRun.findMany({ orderBy: { createdAt: 'asc' } });
    expect(runs.map(({ status }) => status)).toEqual(['FAILED', 'FAILED']);
    for (const run of runs) expect(run.error).toMatch(/^AI_INVALID_OUTPUT/);
  });

  it('uses the corrected answer when the retry is valid', async () => {
    const context = await scenario('STUDY');
    provider.queueReplies({ type: 'toolCall', input: invalidOutput });
    const snapId = await uploadSnap(context);

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    const runs = await prisma.aiRun.findMany({ orderBy: { createdAt: 'asc' } });
    const insight = await prisma.snapInsight.findUniqueOrThrow({ where: { snapId } });
    expect(runs.map(({ status }) => status)).toEqual(['FAILED', 'COMPLETED']);
    expect(insight.aiRunId).toBe(runs[1]?.id);
  });

  it('marks the snap FAILED when the AI provider fails', async () => {
    const context = await scenario('WORK');
    provider.queueReplies({ type: 'error', error: new AiProviderError('AI_TIMEOUT', 'Too slow') });
    const snapId = await uploadSnap(context);

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    expect((await prisma.snap.findUniqueOrThrow({ where: { id: snapId } })).analysisStatus).toBe(
      'FAILED',
    );
    expect((await prisma.aiRun.findFirstOrThrow()).error).toBe('AI_TIMEOUT: Too slow');
  });

  it('waits for start(), then analyzes the snaps a previous run left PENDING or PROCESSING', async () => {
    const context = await scenario('STUDY');
    const pending = await uploadSnap(context);
    const interrupted = await uploadSnap(context);
    const done = await uploadSnap(context);
    await prisma.snap.update({
      where: { id: interrupted },
      data: { analysisStatus: 'PROCESSING' },
    });
    await prisma.snap.update({ where: { id: done }, data: { analysisStatus: 'DONE' } });
    expect(provider.calls).toHaveLength(0);

    // A restart: a new app whose queue only knows the database.
    const restarted = newContext();
    await restarted.aiQueue.start();
    await restarted.aiQueue.onIdle();

    const snaps = await prisma.snap.findMany({ include: { insight: true } });
    const byId = new Map(snaps.map((snap) => [snap.id, snap]));
    expect(byId.get(pending)?.analysisStatus).toBe('DONE');
    expect(byId.get(interrupted)?.analysisStatus).toBe('DONE');
    expect(byId.get(done)?.insight).toBeNull();
    expect(provider.calls).toHaveLength(2);
  });

  it('skips a snap that was deleted before its turn', async () => {
    const context = await scenario('STUDY');
    const snapId = await uploadSnap(context);
    await request(context.app).delete(`/api/snaps/${snapId}`).set(context.token).expect(204);

    await context.aiQueue.start();
    await context.aiQueue.onIdle();

    expect(provider.calls).toHaveLength(0);
    expect(await prisma.aiRun.count()).toBe(0);
  });
});
