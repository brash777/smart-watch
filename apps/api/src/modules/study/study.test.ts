import { randomUUID } from 'node:crypto';
import { flashcardDeckSchema, quizAttemptResultSchema, quizSchema } from '@snapia/shared';
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
const deckResponseSchema = z.object({ data: flashcardDeckSchema });
const quizResponseSchema = z.object({ data: quizSchema.strict() });
const attemptResponseSchema = z.object({ data: quizAttemptResultSchema });
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

/** ana owns a MEMBERS STUDY Space with leo (EDITOR) and sol (VIEWER), and two analyzed snaps. */
async function scenario() {
  context = createDatabaseTestContext({}, { storage, aiProvider: provider });
  const { app, aiQueue } = context;
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
  await aiQueue.start();

  async function analyzedSnaps(spaceId: string, days: string[]): Promise<string[]> {
    let upload = request(app).post(`/api/spaces/${spaceId}/snaps`).set(tokens.ana);
    for (const [index, day] of days.entries()) {
      upload = upload.attach('files', await createTestJpeg({ takenAt: `${day} 09:00:00` }), {
        filename: `${String(index)}.jpg`,
        contentType: 'image/jpeg',
      });
    }
    const response = await upload.expect(201);
    await aiQueue.onIdle();
    return uploadResponseSchema.parse(response.body).data.map(({ id }) => id);
  }

  // Uploaded second, taken first: it is [Snap 1].
  const [later, earlier] = await analyzedSnaps(space.id, ['2024:05:02', '2024:05:01']);
  if (later === undefined || earlier === undefined) throw new Error('No snaps');
  return { app, space, tokens, snapIds: [later, earlier], firstTaken: earlier, analyzedSnaps };
}

async function createQuiz(ctx: Awaited<ReturnType<typeof scenario>>) {
  const response = await request(ctx.app)
    .post(`/api/spaces/${ctx.space.id}/quizzes`)
    .set(ctx.tokens.leo)
    .send({ snapIds: ctx.snapIds })
    .expect(201);
  return quizResponseSchema.parse(response.body).data;
}

describe('POST /api/spaces/:spaceId/flashcards', () => {
  it('generates a FlashcardDeck from the analyzed snaps', async () => {
    const { app, space, tokens, snapIds, firstTaken } = await scenario();

    const response = await request(app)
      .post(`/api/spaces/${space.id}/flashcards`)
      .set(tokens.leo)
      .send({ snapIds });

    expect(response.status).toBe(201);
    const { data } = deckResponseSchema.parse(response.body);
    expect(data).toMatchObject({
      title: 'Diagrama de clases UML',
      promptVersion: 'generate-flashcards.v1',
    });
    expect(data.cards).toHaveLength(3);
    expect(data.cards.map(({ order }) => order)).toEqual([1, 2, 3]);
    expect(data.cards.every(({ sourceSnapId }) => sourceSnapId === firstTaken)).toBe(true);
    expect(await prisma.flashcard.count({ where: { deckId: data.id } })).toBe(3);
    expect(
      (await prisma.aiRun.findFirstOrThrow({ where: { task: 'STUDY_FLASHCARDS' } })).status,
    ).toBe('COMPLETED');
    const call = provider.calls.at(-1)?.request;
    expect(call?.promptName).toBe('generate-flashcards');
    expect(call?.text).toContain(
      `- \`cards\`: ${String(await settingValue('flashcards_default_count'))} flashcards`,
    );
  });
});

describe('POST /api/spaces/:spaceId/quizzes', () => {
  it('generates a Quiz and hides its answers', async () => {
    const ctx = await scenario();

    const quiz = await createQuiz(ctx);

    expect(quiz).toMatchObject({
      title: 'Quiz: diagrama de clases UML',
      promptVersion: 'generate-quiz.v1',
    });
    expect(quiz.questions).toHaveLength(3);
    for (const question of quiz.questions) {
      expect(Object.keys(question).sort()).toEqual([
        'id',
        'options',
        'order',
        'prompt',
        'sourceSnapId',
      ]);
    }
    const stored = await prisma.quizQuestion.findMany({
      where: { quizId: quiz.id },
      orderBy: { order: 'asc' },
    });
    expect(stored.map(({ correctIndex }) => correctIndex)).toEqual([1, 2, 2]);
    const call = provider.calls.at(-1)?.request;
    expect(call?.text).toContain(
      `- \`questions\`: ${String(await settingValue('quiz_default_questions'))} questions`,
    );
  });

  it('is only for STUDY Spaces, and for their EDITORs and OWNERs', async () => {
    const { app, space, tokens, snapIds } = await scenario();
    const owner = await prisma.space.findUniqueOrThrow({ where: { id: space.id } });
    const work = await createSpace(prisma, owner.ownerId, { mode: 'WORK' });
    const generate = (spaceId: string, token: Record<string, string>) =>
      request(app).post(`/api/spaces/${spaceId}/quizzes`).set(token).send({ snapIds });

    const notStudy = await generate(work.id, tokens.ana);

    expect(notStudy.status).toBe(400);
    expect(readError(notStudy.body)).toMatchObject({
      code: 'STUDY_SPACE_REQUIRED',
      details: { mode: 'WORK' },
    });
    expect((await generate(space.id, {})).status).toBe(401);
    expect((await generate(space.id, tokens.sol)).status).toBe(403);
    expect((await generate(space.id, tokens.out)).status).toBe(403);
  });
});

describe('POST /api/quizzes/:id/attempts', () => {
  it('scores the attempt on the server, whatever the client says', async () => {
    const ctx = await scenario();
    const quiz = await createQuiz(ctx);

    // The correct options of the fixture are 1, 2 and 2.
    const response = await request(ctx.app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set(ctx.tokens.sol)
      .send({ answers: [1, 2, 0], score: 3 });

    expect(response.status).toBe(201);
    const { data } = attemptResponseSchema.parse(response.body);
    expect(data).toMatchObject({ quizId: quiz.id, score: 2, total: 3 });
    expect(data.results.map(({ isCorrect }) => isCorrect)).toEqual([true, true, false]);
    expect(data.results[2]).toMatchObject({ chosenIndex: 0, correctIndex: 2 });
    expect(data.results[2]?.explanation).toEqual(expect.any(String) as unknown);
    const attempt = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: data.id } });
    expect(attempt).toMatchObject({ score: 2, answers: [1, 2, 0] });
  });

  it('needs one valid option per question', async () => {
    const ctx = await scenario();
    const quiz = await createQuiz(ctx);
    const attempt = (answers: unknown) =>
      request(ctx.app)
        .post(`/api/quizzes/${quiz.id}/attempts`)
        .set(ctx.tokens.leo)
        .send({ answers });

    const tooFew = await attempt([1, 0]);
    const notAnOption = await attempt([1, 0, 4]);
    const negative = await attempt([1, 0, -1]);

    expect(readError(tooFew.body)).toMatchObject({
      code: 'INVALID_ANSWERS',
      details: { expected: 3 },
    });
    expect(readError(notAnOption.body)).toMatchObject({
      code: 'INVALID_ANSWERS',
      details: { question: 2 },
    });
    expect(readError(negative.body).code).toBe('VALIDATION_ERROR');
    expect(await prisma.quizAttempt.count()).toBe(0);
  });

  it('is for anyone who can see the quiz', async () => {
    const ctx = await scenario();
    const quiz = await createQuiz(ctx);
    const attempt = (quizId: string, token: Record<string, string>) =>
      request(ctx.app)
        .post(`/api/quizzes/${quizId}/attempts`)
        .set(token)
        .send({ answers: [1, 2, 2] });

    expect((await attempt(quiz.id, {})).status).toBe(401);
    expect((await attempt(quiz.id, ctx.tokens.out)).status).toBe(403);
    expect(readError((await attempt(randomUUID(), ctx.tokens.ana)).body).code).toBe(
      'QUIZ_NOT_FOUND',
    );
    expect(
      attemptResponseSchema.parse((await attempt(quiz.id, ctx.tokens.ana)).body).data.score,
    ).toBe(3);
  });
});
