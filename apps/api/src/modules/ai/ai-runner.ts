import type { AiTask } from '@snapia/shared';
import type { Logger } from 'pino';
import type { z } from 'zod';
import { AppError } from '../../lib/app-error';
import { removeContactDetails } from '../../lib/personal-data';
import type { SettingsService } from '../settings/settings.service';
import {
  AiProviderError,
  type AiEffort,
  type AiImage,
  type AiProvider,
  type AiProviderErrorCode,
  type AiReply,
  type AiSpeed,
} from './ai-provider';
import type { AiRunsRepository } from './ai-runs.repository';
import type { PromptLoader, RenderedPrompt } from './prompt-loader';
import { toStrictJsonSchema } from './strict-json-schema';

/*
 * The single way to call the AI. For every task it:
 * 1. sends the prompt (without emails or phone numbers) and the images, asking for one tool call;
 * 2. checks why the model stopped: a refusal or an answer cut off at AI_MAX_TOKENS fails
 *    without retrying;
 * 3. validates the tool input with the task's Zod schema;
 * 4. retries once when the tool call is missing or invalid, sending the reply back with the
 *    problems found (prompts/retry-*.md);
 * 5. records one AiRun per call with tokens, estimated cost, latency and error.
 */

export interface AiTaskRequest<T> {
  task: AiTask;
  prompt: RenderedPrompt;
  images: readonly AiImage[];
  /** The tool the model answers with; its input is validated with the schema. */
  tool: { name: string; description: string; schema: z.ZodType<T> };
  effort: AiEffort;
  speed: AiSpeed;
  /** Stored in the AiRun for the usage panel, never sent to the AI. */
  userId: string;
  spaceId: string | null;
  /** What the task sent, without images (snaps by id), stored in AiRun.input. */
  input: Record<string, unknown>;
}

export interface AiTaskResult<T> {
  output: T;
  /** The AiRun of the call whose answer is used. */
  aiRunId: string;
  promptVersion: string;
}

export interface AiRunnerDependencies {
  provider: AiProvider;
  runs: AiRunsRepository;
  settings: SettingsService;
  prompts: PromptLoader;
  logger: Logger;
}

type ReplyCheck<T> =
  | { ok: true; output: T }
  /** retry: the correction prompt and its values, or null when retrying would not help. */
  | {
      ok: false;
      error: AppError;
      retry: { prompt: string; values: Record<string, string> } | null;
    };

const TOKENS_PER_MILLION = 1_000_000;

/** HTTP status of the AppError that a provider failure becomes. */
const PROVIDER_ERROR_STATUS: Record<AiProviderErrorCode, number> = {
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 503,
  AI_UNAVAILABLE: 503,
  AI_AUTHENTICATION_FAILED: 502,
  AI_REQUEST_REJECTED: 502,
  AI_PROVIDER_ERROR: 502,
};

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `- ${issue.path.map(String).join('.') || '(input)'}: ${issue.message}`)
    .join('\n');
}

function checkReply<T>(reply: AiReply, tool: AiTaskRequest<T>['tool']): ReplyCheck<T> {
  if (reply.stopReason === 'refusal') {
    return {
      ok: false,
      error: new AppError('AI_REFUSED', 'The AI declined to answer', 422),
      retry: null,
    };
  }
  if (reply.stopReason === 'max_tokens') {
    return {
      ok: false,
      error: new AppError('AI_OUTPUT_TRUNCATED', 'The AI answer was cut off at AI_MAX_TOKENS', 502),
      retry: null,
    };
  }
  if (reply.toolCall === null) {
    return {
      ok: false,
      error: new AppError('AI_NO_TOOL_CALL', `The AI answered without calling ${tool.name}`, 502),
      retry: { prompt: 'retry-missing-tool-call', values: { tool_name: tool.name } },
    };
  }
  const parsed = tool.schema.safeParse(reply.toolCall.input);
  if (!parsed.success) {
    const issues = describeIssues(parsed.error);
    return {
      ok: false,
      error: new AppError('AI_INVALID_OUTPUT', `The AI answer does not match ${tool.name}`, 502, {
        issues,
      }),
      retry: { prompt: 'retry-invalid-output', values: { tool_name: tool.name, issues } },
    };
  }
  return { ok: true, output: parsed.data };
}

function errorText(error: unknown): string {
  if (error instanceof AppError || error instanceof AiProviderError) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function createAiRunner({
  provider,
  runs,
  settings,
  prompts,
  logger,
}: AiRunnerDependencies) {
  async function estimateCost(usage: AiReply['usage'], speed: AiSpeed): Promise<number> {
    const [inputPrice, outputPrice, multiplier] = await Promise.all([
      settings.getSetting('ai_cost_per_million_input_tokens'),
      settings.getSetting('ai_cost_per_million_output_tokens'),
      speed === 'fast' ? settings.getSetting('ai_fast_mode_price_multiplier') : 1,
    ]);
    const cost = usage.inputTokens * inputPrice + usage.outputTokens * outputPrice;
    return (cost * multiplier) / TOKENS_PER_MILLION;
  }

  /** One provider call recorded as one AiRun. */
  async function recordedCall<T>(
    request: AiTaskRequest<T>,
    input: Record<string, unknown>,
    send: () => Promise<AiReply>,
  ): Promise<{ aiRunId: string; check: ReplyCheck<T> }> {
    const aiRunId = await runs.start({
      userId: request.userId,
      spaceId: request.spaceId,
      task: request.task,
      provider: provider.name,
      model: provider.model,
      promptVersion: request.prompt.version,
      input,
    });
    const startedAt = performance.now();
    const latency = () => Math.round(performance.now() - startedAt);

    let reply: AiReply;
    try {
      reply = await send();
    } catch (error) {
      await runs.finish(aiRunId, {
        status: 'FAILED',
        output: null,
        error: errorText(error),
        inputTokens: null,
        outputTokens: null,
        latencyMs: latency(),
        estimatedCost: null,
      });
      if (!(error instanceof AiProviderError)) throw error;
      throw new AppError(error.code, error.message, PROVIDER_ERROR_STATUS[error.code]);
    }

    const latencyMs = latency();
    const check = checkReply(reply, request.tool);
    await runs.finish(aiRunId, {
      status: check.ok ? 'COMPLETED' : 'FAILED',
      output: reply.toolCall?.input ?? (reply.text === '' ? null : { text: reply.text }),
      error: check.ok ? null : errorText(check.error),
      inputTokens: reply.usage.inputTokens,
      outputTokens: reply.usage.outputTokens,
      latencyMs,
      estimatedCost: await estimateCost(reply.usage, request.speed),
    });
    if (!check.ok) {
      logger.warn(
        {
          task: request.task,
          promptVersion: request.prompt.version,
          aiRunId,
          code: check.error.code,
        },
        'The AI answer was rejected',
      );
    }
    return { aiRunId, check };
  }

  return {
    async run<T>(request: AiTaskRequest<T>): Promise<AiTaskResult<T>> {
      const conversation = provider.startConversation({
        promptName: request.prompt.name,
        images: request.images,
        text: removeContactDetails(request.prompt.text),
        tool: {
          name: request.tool.name,
          description: request.tool.description,
          inputSchema: toStrictJsonSchema(request.tool.schema),
        },
        effort: request.effort,
        speed: request.speed,
      });
      const promptVersion = request.prompt.version;

      const first = await recordedCall(request, { ...request.input, attempt: 1 }, () =>
        conversation.send(),
      );
      if (first.check.ok)
        return { output: first.check.output, aiRunId: first.aiRunId, promptVersion };
      if (first.check.retry === null) throw first.check.error;

      const correction = await prompts.render(first.check.retry.prompt, first.check.retry.values);
      const second = await recordedCall(
        request,
        { ...request.input, attempt: 2, correctionPrompt: correction.version },
        () => conversation.sendCorrection(removeContactDetails(correction.text)),
      );
      if (second.check.ok) {
        return { output: second.check.output, aiRunId: second.aiRunId, promptVersion };
      }
      throw second.check.error;
    },
  };
}

export type AiRunner = ReturnType<typeof createAiRunner>;
