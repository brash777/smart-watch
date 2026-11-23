import { askExchangeSchema } from '@snapia/shared';
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
const exchangeResponseSchema = z.object({ data: askExchangeSchema });
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
  const response = await request(app)
    .post(`/api/spaces/${space.id}/snaps`)
    .set(tokens.leo)
    .field('note', 'Integrales por partes')
    .attach('files', await createTestJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
    .expect(201);
  await request(app)
    .post(`/api/spaces/${space.id}/snaps`)
    .set(tokens.leo)
    .field('note', 'Diagrama de la célula animal')
    .attach('files', await createTestJpeg(), { filename: 'b.jpg', contentType: 'image/jpeg' })
    .expect(201);
  await aiQueue.onIdle();
  const [integrals] = uploadResponseSchema.parse(response.body).data;
  return { app, users: { ana, leo }, space, tokens, integralsSnapId: integrals?.id ?? '' };
}

describe('POST /api/spaces/:spaceId/ask', () => {
  it('answers with the snaps that share more words with the question, and saves both messages', async () => {
    const { app, users, space, tokens } = await scenario();
    const chainSnap = await prisma.snap.findFirstOrThrow({
      where: { note: { contains: 'célula' } },
    });

    const response = await request(app)
      .post(`/api/spaces/${space.id}/ask`)
      .set(tokens.leo)
      .send({ question: '¿Qué organelos tiene la célula animal?' });

    expect(response.status).toBe(201);
    const { data } = exchangeResponseSchema.parse(response.body);
    expect(data.found).toBe(true);
    expect(data.question).toMatchObject({
      role: 'USER',
      content: '¿Qué organelos tiene la célula animal?',
    });
    expect(data.answer).toMatchObject({ role: 'ASSISTANT', citedSnapIds: [chainSnap.id] });
    expect(data.answer.content).toContain('[Snap 1]');

    const stored = await prisma.askMessage.findMany({ orderBy: { createdAt: 'asc' } });
    expect(stored.map(({ role }) => role)).toEqual(['USER', 'ASSISTANT']);
    expect(stored[1]).toMatchObject({ userId: users.leo.id, promptVersion: 'ask-space.v1' });
    expect(stored[1]?.aiRunId).not.toBeNull();

    const sent = provider.calls.at(-1)?.request;
    expect(sent?.promptName).toBe('ask-space');
    const text = sent?.text ?? '';
    expect(text).toContain('¿Qué organelos tiene la célula animal?');
    // The snap about the cell goes first.
    expect(text.indexOf('Diagrama de la célula animal')).toBeLessThan(
      text.indexOf('Integrales por partes'),
    );
  });

  it('sends the previous messages of the conversation without their citations', async () => {
    const { app, space, tokens } = await scenario();
    const ask = (question: string) =>
      request(app)
        .post(`/api/spaces/${space.id}/ask`)
        .set(tokens.leo)
        .send({ question })
        .expect(201);

    await ask('¿Qué es el núcleo de la célula?');
    await ask('¿Y un ejemplo?');

    const text = provider.calls.at(-1)?.request.text ?? '';
    const history = text.slice(text.indexOf('<history>'), text.indexOf('</history>'));
    expect(history).toContain('- Question: ¿Qué es el núcleo de la célula?');
    expect(history).toContain('- Answer: El núcleo contiene el ADN');
    expect(history).not.toContain('[Snap');
  });

  it('says so when the snaps do not have the answer', async () => {
    const { app, space, tokens } = await scenario();
    provider.queueReplies({
      type: 'toolCall',
      input: { answer: 'Los snaps no hablan de fotosíntesis.', found: false },
    });

    const response = await request(app)
      .post(`/api/spaces/${space.id}/ask`)
      .set(tokens.leo)
      .send({ question: '¿Qué es la fotosíntesis?' });

    const { data } = exchangeResponseSchema.parse(response.body);
    expect(data.found).toBe(false);
    expect(data.answer.citedSnapIds).toEqual([]);
  });

  it('needs analyzed snaps, a question, and an EDITOR or an OWNER', async () => {
    const { app, users, space, tokens } = await scenario();
    const empty = await createSpace(prisma, users.ana.id, { mode: 'WORK' });
    const ask = (spaceId: string, token: Record<string, string>, question = '¿Qué hicimos?') =>
      request(app).post(`/api/spaces/${spaceId}/ask`).set(token).send({ question });

    expect(readError((await ask(empty.id, tokens.ana)).body).code).toBe('NO_ANALYZED_SNAPS');
    expect(readError((await ask(space.id, tokens.leo, '  ')).body).code).toBe('VALIDATION_ERROR');
    expect((await ask(space.id, {})).status).toBe(401);
    expect((await ask(space.id, tokens.sol)).status).toBe(403);
    expect((await ask(space.id, tokens.out)).status).toBe(403);
    expect(await prisma.askMessage.count()).toBe(0);
  });
});
