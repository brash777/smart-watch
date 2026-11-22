import type { Config } from '../../config/env';
import type { AiProvider } from './ai-provider';
import { createAnthropicAiProvider } from './providers/anthropic-ai-provider';
import { createMockAiProvider } from './providers/mock-ai-provider';

/** The provider chosen with AI_PROVIDER. */
export function createAiProvider(config: Config['ai']): AiProvider {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicAiProvider(config);
    case 'mock':
      return createMockAiProvider({ model: config.model });
  }
}
