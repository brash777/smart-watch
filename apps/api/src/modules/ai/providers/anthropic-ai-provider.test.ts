import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../../../../test/test-config';
import type { AiRequest } from '../ai-provider';
import {
  createAnthropicAiProvider,
  type AnthropicAiProviderOptions,
} from './anthropic-ai-provider';

/*
 * The real provider with a fake fetch: it checks the requests the SDK would send to the
 * Claude API and how the answers are read, without network calls.
 */

type FakeAnswer = { status: number; body: unknown } | 'network-failure' | 'no-answer';

interface SentRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

const config = createTestConfig({
  AI_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'test-key',
  AI_MAX_RETRIES: '0',
});

function fakeClaude(answers: FakeAnswer[]) {
  const sent: SentRequest[] = [];
  const fetch: NonNullable<AnthropicAiProviderOptions['fetch']> = (input, init) => {
    sent.push({
      url: input instanceof Request ? input.url : String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<
        string,
        unknown
      >,
    });
    const answer = answers.shift();
    if (answer === undefined) return Promise.reject(new Error('No fake answer left'));
    if (answer === 'network-failure') return Promise.reject(new TypeError('fetch failed'));
    if (answer === 'no-answer') {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    }
    return Promise.resolve(
      new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { fetch, sent };
}

function message(content: unknown[], stopReason = 'tool_use'): FakeAnswer {
  return {
    status: 200,
    body: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: config.ai.model,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: 1200,
        output_tokens: 340,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  };
}

function apiError(status: number, type: string): FakeAnswer {
  return { status, body: { type: 'error', error: { type, message: `${type} for the test` } } };
}

const thinking = { type: 'thinking', thinking: '', signature: 'signature-1' };
const toolUse = {
  type: 'tool_use',
  id: 'toolu_1',
  name: 'save_snap_insight',
  input: { summary: 'Pizarra.' },
};

const photo = Buffer.from('fake jpeg bytes');
const request: AiRequest = {
  promptName: 'snap-analysis.study',
  images: [{ mediaType: 'image/jpeg', data: photo, width: 800, height: 600 }],
  text: 'Analyze the snap.',
  tool: {
    name: 'save_snap_insight',
    description: 'Saves the analysis of the snap.',
    inputSchema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
      additionalProperties: false,
    },
  },
  effort: 'low',
  speed: 'standard',
};

function providerWith(answers: FakeAnswer[], overrides: Record<string, string> = {}) {
  const claude = fakeClaude(answers);
  const providerConfig = createTestConfig({
    AI_PROVIDER: 'anthropic',
    ANTHROPIC_API_KEY: 'test-key',
    AI_MAX_RETRIES: '0',
    ...overrides,
  });
  return {
    provider: createAnthropicAiProvider(providerConfig.ai, { fetch: claude.fetch }),
    claude,
  };
}

describe('AnthropicAiProvider', () => {
  it('sends the image before the prompt and asks for one strict tool call', async () => {
    const { provider, claude } = providerWith([message([toolUse])]);

    await provider.startConversation(request).send();

    const [sent] = claude.sent;
    expect(sent?.url).toMatch(/\/v1\/messages$/);
    expect(sent?.headers.get('authorization')).toBe('Bearer test-key');
    expect(sent?.body).toEqual({
      model: config.ai.model,
      max_tokens: config.ai.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') },
            },
            { type: 'text', text: 'Analyze the snap.' },
          ],
        },
      ],
      tools: [
        {
          name: 'save_snap_insight',
          description: 'Saves the analysis of the snap.',
          input_schema: request.tool.inputSchema,
          strict: true,
        },
      ],
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      output_config: { effort: 'low' },
    });
    expect(provider).toMatchObject({ name: 'anthropic', model: config.ai.model });
  });

  it('asks for fast mode only when the speed is fast', async () => {
    const { provider, claude } = providerWith([message([toolUse])]);

    await provider.startConversation({ ...request, speed: 'fast' }).send();

    expect(claude.sent[0]?.body.speed).toBe('fast');
  });

  it('finds the tool call among thinking and text blocks', async () => {
    const { provider } = providerWith([
      message([thinking, { type: 'text', text: 'Guardo el análisis.', citations: null }, toolUse]),
    ]);

    const reply = await provider.startConversation(request).send();

    expect(reply).toEqual({
      stopReason: 'tool_use',
      toolCall: { input: { summary: 'Pizarra.' } },
      text: 'Guardo el análisis.',
      usage: { inputTokens: 1200, outputTokens: 340 },
    });
  });

  it('reports refusals and answers without the tool call', async () => {
    const { provider } = providerWith([
      message([], 'refusal'),
      message([{ type: 'text', text: 'No puedo.', citations: null }], 'end_turn'),
    ]);

    expect(await provider.startConversation(request).send()).toMatchObject({
      stopReason: 'refusal',
      toolCall: null,
    });
    expect(await provider.startConversation(request).send()).toMatchObject({
      stopReason: 'end_turn',
      toolCall: null,
      text: 'No puedo.',
    });
  });

  it('corrects a tool call by sending the reply back as received with a failed tool result', async () => {
    const { provider, claude } = providerWith([message([thinking, toolUse]), message([toolUse])]);
    const conversation = provider.startConversation(request);

    await conversation.send();
    await conversation.sendCorrection('summary: too short');

    expect(claude.sent[1]?.body.messages).toEqual([
      expect.objectContaining({ role: 'user' }),
      { role: 'assistant', content: [thinking, toolUse] },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            is_error: true,
            content: 'summary: too short',
          },
        ],
      },
    ]);
  });

  it('asks again with a user message when the model did not call the tool', async () => {
    const text = { type: 'text', text: 'Hola', citations: null };
    const { provider, claude } = providerWith([message([text], 'end_turn'), message([toolUse])]);
    const conversation = provider.startConversation(request);

    await conversation.send();
    const reply = await conversation.sendCorrection('Call save_snap_insight');

    expect(reply.toolCall).toEqual({ input: { summary: 'Pizarra.' } });
    expect(claude.sent[1]?.body.messages).toEqual([
      expect.objectContaining({ role: 'user' }),
      { role: 'assistant', content: [text] },
      { role: 'user', content: 'Call save_snap_insight' },
    ]);
  });

  it.each([
    [apiError(429, 'rate_limit_error'), 'AI_RATE_LIMITED'],
    [apiError(401, 'authentication_error'), 'AI_AUTHENTICATION_FAILED'],
    [apiError(400, 'invalid_request_error'), 'AI_REQUEST_REJECTED'],
    [apiError(529, 'overloaded_error'), 'AI_UNAVAILABLE'],
    ['network-failure' as const, 'AI_UNAVAILABLE'],
  ])('turns API failures into AiProviderErrors (%#)', async (answer, code) => {
    const { provider } = providerWith([answer]);

    await expect(provider.startConversation(request).send()).rejects.toMatchObject({
      name: 'AiProviderError',
      code,
    });
  });

  it('gives up after AI_TIMEOUT_MS', async () => {
    const { provider } = providerWith(['no-answer'], { AI_TIMEOUT_MS: '20' });

    await expect(provider.startConversation(request).send()).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
  });

  it('needs ANTHROPIC_API_KEY', () => {
    expect(() => createAnthropicAiProvider({ ...config.ai, anthropicApiKey: undefined })).toThrow(
      'ANTHROPIC_API_KEY',
    );
  });
});
