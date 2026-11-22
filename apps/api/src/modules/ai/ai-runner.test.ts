import { studySnapInsightSchema } from '@snapia/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSpace, createUser } from '../../../test/factories';
import { createTestConfig } from '../../../test/test-config';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import { createLogger } from '../../lib/logger';
import { createSettingsRepository } from '../settings/settings.repository';
import { createSettingsService } from '../settings/settings.service';
import { AiProviderError } from './ai-provider';
import { createAiRunner, type AiTaskRequest } from './ai-runner';
import { createAiRunsRepository } from './ai-runs.repository';
import { createPromptLoader } from './prompt-loader';
import { createMockAiProvider, type MockAiProvider } from './providers/mock-ai-provider';

const prisma = getTestPrisma();
const config = createTestConfig();

let provider: MockAiProvider;
let request: AiTaskRequest<unknown>;

beforeEach(async () => {
  await resetTestDatabase();
  provider = createMockAiProvider({ model: config.ai.model });
  const user = await createUser(prisma);
  const space = await createSpace(prisma, user.id);
  request = {
    task: 'SNAP_ANALYSIS',
    prompt: {
      name: 'snap-analysis.study',
      version: 'snap-analysis.study.v1',
      text: 'Analiza el snap. Nota: escribir a ana@example.com o al +57 300 123 4567.',
    },
    images: [],
    tool: { name: 'save_snap_insight', description: 'Saves it.', schema: studySnapInsightSchema },
    effort: 'low',
    speed: 'standard',
    userId: user.id,
    spaceId: space.id,
    input: { snapId: 'snap-1' },
  };
});
afterAll(disconnectTestPrisma);

function createRunner() {
  return createAiRunner({
    provider,
    runs: createAiRunsRepository(prisma),
    settings: createSettingsService(createSettingsRepository(prisma)),
    prompts: createPromptLoader(),
    logger: createLogger(config),
  });
}

function aiRuns() {
  return prisma.aiRun.findMany({ orderBy: { createdAt: 'asc' } });
}

async function prices() {
  const value = async (key: string) =>
    Number((await prisma.appSetting.findUniqueOrThrow({ where: { key } })).value);
  return {
    input: await value('ai_cost_per_million_input_tokens'),
    output: await value('ai_cost_per_million_output_tokens'),
    fastMultiplier: await value('ai_fast_mode_price_multiplier'),
  };
}

const invalidStudyOutput = { summary: '', contentType: 'PHOTO' };

describe('AI runner', () => {
  it('validates the answer and records the call with tokens, cost and latency', async () => {
    const result = await createRunner().run(request);

    expect(studySnapInsightSchema.safeParse(result.output).success).toBe(true);
    expect(result.promptVersion).toBe('snap-analysis.study.v1');
    const [run] = await aiRuns();
    const { input, output } = await prices();
    expect(run).toMatchObject({
      id: result.aiRunId,
      userId: request.userId,
      spaceId: request.spaceId,
      task: 'SNAP_ANALYSIS',
      status: 'COMPLETED',
      provider: 'mock',
      model: config.ai.model,
      promptVersion: 'snap-analysis.study.v1',
      input: { snapId: 'snap-1', attempt: 1 },
      error: null,
    });
    expect(run?.inputTokens).toBeGreaterThan(0);
    expect(run?.outputTokens).toBeGreaterThan(0);
    expect(run?.latencyMs).toBeGreaterThanOrEqual(0);
    const expectedCost =
      ((run?.inputTokens ?? 0) * input + (run?.outputTokens ?? 0) * output) / 1_000_000;
    expect(Number(run?.estimatedCost)).toBeCloseTo(expectedCost, 6);
    expect(run?.output).toMatchObject({ contentType: 'WHITEBOARD' });
  });

  it('removes emails and phone numbers from the prompt before the provider gets it', async () => {
    await createRunner().run(request);

    const sent = provider.calls[0]?.request.text ?? '';
    expect(sent).toContain('[email]');
    expect(sent).toContain('[phone]');
    expect(sent).not.toContain('ana@example.com');
    expect(sent).not.toContain('300 123 4567');
  });

  it('retries once with the problems when the output is invalid', async () => {
    provider.queueReplies({ type: 'toolCall', input: invalidStudyOutput });

    const result = await createRunner().run(request);

    const [failed, completed] = await aiRuns();
    expect(failed).toMatchObject({ status: 'FAILED', input: { attempt: 1 } });
    expect(failed?.error).toMatch(/^AI_INVALID_OUTPUT/);
    expect(completed).toMatchObject({
      id: result.aiRunId,
      status: 'COMPLETED',
      input: { attempt: 2, correctionPrompt: 'retry-invalid-output.v1' },
    });
    const correction = provider.calls[1]?.correction ?? '';
    expect(correction).toContain('save_snap_insight');
    expect(correction).toMatch(/- summary: /);
    expect(correction).toMatch(/- contentType: /);
  });

  it('fails with AI_INVALID_OUTPUT when the retry is invalid too, recording both calls', async () => {
    provider.queueReplies(
      { type: 'toolCall', input: invalidStudyOutput },
      { type: 'toolCall', input: invalidStudyOutput },
    );

    await expect(createRunner().run(request)).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });

    const runs = await aiRuns();
    expect(runs.map(({ status }) => status)).toEqual(['FAILED', 'FAILED']);
    expect(runs.every(({ error }) => error?.startsWith('AI_INVALID_OUTPUT'))).toBe(true);
    expect(runs.every(({ inputTokens }) => (inputTokens ?? 0) > 0)).toBe(true);
  });

  it('asks for the tool call when the model only wrote text', async () => {
    provider.queueReplies({ type: 'noToolCall', text: 'Aquí está el análisis.' });

    await createRunner().run(request);

    const [failed] = await aiRuns();
    expect(failed?.error).toMatch(/^AI_NO_TOOL_CALL/);
    expect(failed?.output).toEqual({ text: 'Aquí está el análisis.' });
    expect(provider.calls[1]?.correction).toContain('You did not call `save_snap_insight`');
  });

  it.each([
    [{ type: 'refusal' } as const, 'AI_REFUSED'],
    [{ type: 'maxTokens' } as const, 'AI_OUTPUT_TRUNCATED'],
  ])('does not retry a %o answer', async (reply, code) => {
    provider.queueReplies(reply);

    await expect(createRunner().run(request)).rejects.toMatchObject({ code });

    expect(provider.calls).toHaveLength(1);
    const runs = await aiRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.error).toMatch(new RegExp(`^${code}`));
  });

  it('records provider failures and reports them as AppErrors', async () => {
    provider.queueReplies({ type: 'error', error: new AiProviderError('AI_TIMEOUT', 'Too slow') });

    await expect(createRunner().run(request)).rejects.toMatchObject({
      name: 'AppError',
      code: 'AI_TIMEOUT',
      status: 504,
    });

    const [run] = await aiRuns();
    expect(run).toMatchObject({
      status: 'FAILED',
      error: 'AI_TIMEOUT: Too slow',
      inputTokens: null,
      estimatedCost: null,
    });
  });

  it('applies the fast mode price multiplier', async () => {
    await createRunner().run({ ...request, speed: 'fast' });

    const [run] = await aiRuns();
    const { input, output, fastMultiplier } = await prices();
    const standardCost =
      ((run?.inputTokens ?? 0) * input + (run?.outputTokens ?? 0) * output) / 1_000_000;
    expect(Number(run?.estimatedCost)).toBeCloseTo(standardCost * fastMultiplier, 6);
  });
});
