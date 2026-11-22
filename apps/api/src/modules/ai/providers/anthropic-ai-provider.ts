import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
import type { Config } from '../../../config/env';
import {
  AiProviderError,
  type AiImage,
  type AiProvider,
  type AiProviderErrorCode,
  type AiReply,
  type AiRequest,
  type AiStopReason,
} from '../ai-provider';

/*
 * Claude through the official SDK (AI_PROVIDER=anthropic). The model, the output tokens, the
 * timeout and the retries of failed calls (network, rate limits, overload) come from config.
 *
 * The answer is a call to one strict tool, whose input schema the runner generates from Zod.
 * Current models reject forced tool use (tool_choice "any" or "tool") with a 400, so the
 * request uses tool_choice "auto", the prompt asks for the call and the runner checks it.
 * No temperature, top_p or top_k: current models only accept their default sampling.
 */

export interface AnthropicAiProviderOptions {
  /** Replaces the network calls (tests). */
  fetch?: ClientOptions['fetch'];
}

const STOP_REASONS: Partial<Record<Anthropic.StopReason, AiStopReason>> = {
  end_turn: 'end_turn',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
};

function toImageBlock({ mediaType, data }: AiImage): Anthropic.ImageBlockParam {
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: data.toString('base64') },
  };
}

function toReply(message: Anthropic.Message, toolName: string): AiReply {
  // The content can also hold thinking and text blocks: the tool call is found by its type.
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === toolName,
  );
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  return {
    stopReason: (message.stop_reason && STOP_REASONS[message.stop_reason]) ?? 'other',
    toolCall: toolUse === undefined ? null : { input: toolUse.input },
    text,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
  };
}

function errorCodeOf(error: unknown): AiProviderErrorCode {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'AI_TIMEOUT';
  if (error instanceof Anthropic.APIConnectionError) return 'AI_UNAVAILABLE';
  if (error instanceof Anthropic.RateLimitError) return 'AI_RATE_LIMITED';
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return 'AI_AUTHENTICATION_FAILED';
  }
  if (error instanceof Anthropic.InternalServerError) return 'AI_UNAVAILABLE';
  if (error instanceof Anthropic.BadRequestError) return 'AI_REQUEST_REJECTED';
  return 'AI_PROVIDER_ERROR';
}

/** SDK failures become AiProviderErrors; anything else is a bug and is thrown as it is. */
function toProviderError(error: unknown): unknown {
  if (!(error instanceof Anthropic.APIError)) return error;
  return new AiProviderError(errorCodeOf(error), error.message, { cause: error });
}

export function createAnthropicAiProvider(
  config: Config['ai'],
  options: AnthropicAiProviderOptions = {},
): AiProvider {
  if (config.anthropicApiKey === undefined) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
  }
  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return {
    name: 'anthropic',
    model: config.model,

    startConversation(request: AiRequest) {
      const tool: Anthropic.Tool = {
        name: request.tool.name,
        description: request.tool.description,
        input_schema: { ...request.tool.inputSchema, type: 'object' },
        strict: true,
      };
      // Images first, then the prompt.
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: [...request.images.map(toImageBlock), { type: 'text', text: request.text }],
        },
      ];
      let lastReply: Anthropic.Message | undefined;

      async function call(): Promise<AiReply> {
        try {
          lastReply = await client.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            messages,
            tools: [tool],
            tool_choice: { type: 'auto', disable_parallel_tool_use: true },
            output_config: { effort: request.effort },
            ...(request.speed === 'fast' ? { speed: 'fast' as const } : {}),
          });
        } catch (error) {
          throw toProviderError(error);
        }
        return toReply(lastReply, request.tool.name);
      }

      return {
        send: call,

        async sendCorrection(feedback) {
          if (lastReply === undefined) throw new Error('sendCorrection() needs a first reply');
          const toolUses = lastReply.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
          );
          // The assistant turn goes back exactly as received, thinking blocks included.
          messages.push({ role: 'assistant', content: lastReply.content });
          messages.push({
            role: 'user',
            content:
              toolUses.length === 0
                ? feedback
                : toolUses.map((toolUse) => ({
                    type: 'tool_result' as const,
                    tool_use_id: toolUse.id,
                    is_error: true,
                    content: feedback,
                  })),
          });
          return call();
        },
      };
    },
  };
}
