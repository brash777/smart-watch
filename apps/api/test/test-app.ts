import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { EventBus } from '../src/lib/events';
import { createLogger } from '../src/lib/logger';
import { getPrisma, type PrismaClient } from '../src/lib/prisma';
import { createStorageProvider, type StorageProvider } from '../src/lib/storage';
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
}

/** The real Express app wired with a test configuration (overrides use env variable names). */
export function createTestApp(
  overrides: Record<string, string | undefined> = {},
  { prisma, storage, events }: TestAppOptions = {},
): { app: Express; config: Config } {
  const config = createTestConfig(overrides);
  const logger = createLogger(config);
  const app = createApp({
    config,
    logger,
    prisma: prisma ?? getPrisma(config.database.url),
    storage: storage ?? createStorageProvider(config.storage),
    events: events ?? new EventBus(logger),
  });
  return { app, config };
}
