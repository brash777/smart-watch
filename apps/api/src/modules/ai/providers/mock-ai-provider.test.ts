import { snapInsightDataSchemas, type SpaceMode } from '@snapia/shared';
import { describe, expect, it } from 'vitest';
import { AiProviderError, type AiRequest } from '../ai-provider';
import { createMockAiProvider } from './mock-ai-provider';

function requestFor(promptName: string): AiRequest {
  return {
    promptName,
    images: [{ mediaType: 'image/jpeg', data: Buffer.from('photo'), width: 750, height: 1000 }],
    text: 'Analyze the snap.',
    tool: { name: 'save_snap_insight', description: 'Saves it.', inputSchema: { type: 'object' } },
    effort: 'low',
    speed: 'standard',
  };
}

describe('MockAiProvider', () => {
  it.each(Object.keys(snapInsightDataSchemas) as SpaceMode[])(
    'answers the %s snap analysis with a fixture that matches its output schema',
    async (mode) => {
      const provider = createMockAiProvider({ model: 'test-model' });

      const reply = await provider
        .startConversation(requestFor(`snap-analysis.${mode.toLowerCase()}`))
        .send();

      expect(reply.stopReason).toBe('tool_use');
      expect(snapInsightDataSchemas[mode].safeParse(reply.toolCall?.input).success).toBe(true);
    },
  );

  it('reports plausible token usage: text plus width × height / 750 per image', async () => {
    const provider = createMockAiProvider({ model: 'test-model' });

    const { usage } = await provider.startConversation(requestFor('snap-analysis.study')).send();

    expect(usage.inputTokens).toBeGreaterThan(1000);
    expect(usage.outputTokens).toBeGreaterThan(0);
  });

  it('plays the scripted replies in order, then the fixtures again', async () => {
    const provider = createMockAiProvider({ model: 'test-model' });
    const failure = new AiProviderError('AI_TIMEOUT', 'too slow');
    provider.queueReplies(
      { type: 'toolCall', input: { wrong: true } },
      { type: 'noToolCall', text: 'Hola' },
      { type: 'refusal' },
      { type: 'maxTokens' },
      { type: 'error', error: failure },
    );
    const conversation = provider.startConversation(requestFor('snap-analysis.work'));

    expect((await conversation.send()).toolCall).toEqual({ input: { wrong: true } });
    expect(await conversation.sendCorrection('Call the tool')).toMatchObject({
      stopReason: 'end_turn',
      toolCall: null,
      text: 'Hola',
    });
    expect((await conversation.send()).stopReason).toBe('refusal');
    expect((await conversation.send()).stopReason).toBe('max_tokens');
    await expect(conversation.send()).rejects.toBe(failure);
    expect((await conversation.send()).toolCall?.input).toHaveProperty('activity');
  });

  it('records every call with its correction', async () => {
    const provider = createMockAiProvider({ model: 'test-model' });
    const request = requestFor('snap-analysis.content');
    const conversation = provider.startConversation(request);

    await conversation.send();
    await conversation.sendCorrection('Fix qualityScore');

    expect(provider.calls).toEqual([
      { request, correction: null },
      { request, correction: 'Fix qualityScore' },
    ]);
  });

  it('never shares the fixture object between answers', async () => {
    const provider = createMockAiProvider({ model: 'test-model' });
    const first = await provider.startConversation(requestFor('snap-analysis.study')).send();
    (first.toolCall?.input as { summary: string }).summary = 'changed';

    const second = await provider.startConversation(requestFor('snap-analysis.study')).send();

    expect((second.toolCall?.input as { summary: string }).summary).not.toBe('changed');
  });
});
