import { readFile } from 'node:fs/promises';
import { FIXTURES_DIRECTORY } from '../ai-files';
import type {
  AiImage,
  AiProvider,
  AiProviderError,
  AiReply,
  AiRequest,
  AiStopReason,
} from '../ai-provider';

/*
 * AI provider for tests and local development (AI_PROVIDER=mock). It never calls the network:
 * it answers by calling the requested tool with the fixture of the prompt
 * (fixtures/<prompt name>.json), with plausible fake token usage.
 */

/** A scripted answer for the next call, to exercise the error paths. */
export type MockAiReply =
  /** The fixture of the prompt: what the mock answers when nothing is scripted. */
  | { type: 'fixture' }
  /** A call to the requested tool with this input, valid or not. */
  | { type: 'toolCall'; input: unknown }
  /** Only text, without the tool call. */
  | { type: 'noToolCall'; text: string }
  | { type: 'refusal' }
  /** The answer was cut off at AI_MAX_TOKENS. */
  | { type: 'maxTokens' }
  | { type: 'error'; error: AiProviderError };

/** One call the mock received. */
export interface MockAiCall {
  request: AiRequest;
  /** The feedback of a correction, or null for the first call of a conversation. */
  correction: string | null;
}

export interface MockAiProvider extends AiProvider {
  /** Every call, in order, so tests can check what would have been sent. */
  readonly calls: MockAiCall[];
  /** Answers for the next calls, in order; once they are used up, the fixtures answer again. */
  queueReplies(...replies: MockAiReply[]): void;
}

/** Anthropic's estimate of the tokens of an image: width × height / 750. */
const PIXELS_PER_IMAGE_TOKEN = 750;
/** A rough average for text. */
const CHARACTERS_PER_TOKEN = 4;

function imageTokens({ width, height }: AiImage): number {
  return Math.ceil((width * height) / PIXELS_PER_IMAGE_TOKEN);
}

function textTokens(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}

export function createMockAiProvider({ model }: { model: string }): MockAiProvider {
  const calls: MockAiCall[] = [];
  const scripted: MockAiReply[] = [];
  const fixtures = new Map<string, Promise<unknown>>();

  function fixtureOf(promptName: string): Promise<unknown> {
    let fixture = fixtures.get(promptName);
    if (fixture === undefined) {
      const file = new URL(`${promptName}.json`, FIXTURES_DIRECTORY);
      fixture = readFile(file, 'utf8').then((text): unknown => JSON.parse(text));
      fixtures.set(promptName, fixture);
    }
    // A copy, so a caller that changes the answer never changes the fixture.
    return fixture.then((value) => structuredClone(value));
  }

  async function answer(request: AiRequest, correction: string | null): Promise<AiReply> {
    calls.push({ request, correction });
    const next = scripted.shift() ?? { type: 'fixture' };
    if (next.type === 'error') throw next.error;

    let stopReason: AiStopReason = 'tool_use';
    let toolCall: AiReply['toolCall'] = null;
    let text = '';
    switch (next.type) {
      case 'fixture':
        toolCall = { input: await fixtureOf(request.promptName) };
        break;
      case 'toolCall':
        toolCall = { input: next.input };
        break;
      case 'noToolCall':
        stopReason = 'end_turn';
        text = next.text;
        break;
      case 'refusal':
        stopReason = 'refusal';
        break;
      case 'maxTokens':
        stopReason = 'max_tokens';
        break;
    }

    const sentText = request.text + JSON.stringify(request.tool.inputSchema) + (correction ?? '');
    const inputTokens =
      textTokens(sentText) + request.images.reduce((sum, image) => sum + imageTokens(image), 0);
    const outputTokens = textTokens(text + JSON.stringify(toolCall?.input ?? ''));
    return { stopReason, toolCall, text, usage: { inputTokens, outputTokens } };
  }

  return {
    name: 'mock',
    model,
    calls,
    queueReplies(...replies) {
      scripted.push(...replies);
    },
    startConversation(request) {
      return {
        send: () => answer(request, null),
        sendCorrection: (feedback) => answer(request, feedback),
      };
    },
  };
}
