import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { createLogger } from '../src/lib/logger';
import { createTestConfig } from './test-config';

/** The real Express app wired with a test configuration (overrides use env variable names). */
export function createTestApp(overrides: Record<string, string | undefined> = {}): {
  app: Express;
  config: Config;
} {
  const config = createTestConfig(overrides);
  return { app: createApp({ config, logger: createLogger(config) }), config };
}
