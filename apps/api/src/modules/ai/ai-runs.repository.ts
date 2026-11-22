import type { AiTask } from '@snapia/shared';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';

export interface NewAiRun {
  userId: string;
  spaceId: string | null;
  task: AiTask;
  provider: string;
  model: string;
  promptVersion: string;
  /** What was sent to the AI, without images. */
  input: Record<string, unknown>;
}

export interface FinishedAiRun {
  status: 'COMPLETED' | 'FAILED';
  /** What the AI answered; null when it answered nothing. */
  output: unknown;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  /** USD. */
  estimatedCost: number | null;
}

/** Values that came from JSON (the AI answer, the task input) stored in a Json column. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function createAiRunsRepository(prisma: PrismaClient) {
  return {
    /** Records a call that is starting (PROCESSING), so a call that never ends is still visible. */
    async start(run: NewAiRun): Promise<string> {
      const { id } = await prisma.aiRun.create({
        data: { ...run, input: toJson(run.input), status: 'PROCESSING' },
        select: { id: true },
      });
      return id;
    },

    async finish(id: string, { output, ...result }: FinishedAiRun): Promise<void> {
      await prisma.aiRun.update({
        where: { id },
        data: { ...result, ...(output === null ? {} : { output: toJson(output) }) },
      });
    },
  };
}

export type AiRunsRepository = ReturnType<typeof createAiRunsRepository>;
