import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { EventBus } from '../src/lib/events';
import { createLogger } from '../src/lib/logger';
import { getPrisma, type PrismaClient } from '../src/lib/prisma';
import { createStorageProvider, type StorageProvider } from '../src/lib/storage';
import type { AiQueue } from '../src/modules/ai/ai-queue';
import type { AiProvider } from '../src/modules/ai/ai-provider';
import { createAiProvider } from '../src/modules/ai/create-ai-provider';
import { createTestConfig } from './test-config';

export interface TestAppOptions {
  /**
   * Database client for tests that use the database (see test/test-database.ts).
   * By default the app gets a client that is never connected: fine for tests without queries.
   */
  prisma?: PrismaClient;
  /** By default, the storage of the test config (STORAGE_DRIVER). */
  storage?: StorageProvider;
  /** Pass a bus to observe the events the app emits. */
  events?: EventBus;
  /** By default, the provider of the test config (AI_PROVIDER=mock in .env.example). */
  aiProvider?: AiProvider;
}

export interface TestApp {
  app: Express;
  config: Config;
  /** Paused, as in the real app before it listens: call start() to analyze snaps. */
  aiQueue: AiQueue;
}

/** The real Express app wired with a test configuration (overrides use env variable names). */
export function createTestApp(
  overrides: Record<string, string | undefined> = {},
  { prisma, storage, events, aiProvider }: TestAppOptions = {},
): TestApp {
  const config = createTestConfig(overrides);
  const logger = createLogger(config);
  const { app, aiQueue } = createApp({
    config,
    logger,
    prisma: prisma ?? getPrisma(config.database.url),
    storage: storage ?? createStorageProvider(config.storage),
    events: events ?? new EventBus(logger),
    aiProvider: aiProvider ?? createAiProvider(config.ai),
  });
  return { app, config, aiQueue };
}
