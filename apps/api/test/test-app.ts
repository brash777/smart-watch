import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { createLogger } from '../src/lib/logger';
import { getPrisma, type PrismaClient } from '../src/lib/prisma';
import { createTestConfig } from './test-config';

export interface TestAppOptions {
  /**
   * Database client for tests that use the database (see test/test-database.ts).
   * By default the app gets a client that is never connected: fine for tests without queries.
   */
  prisma?: PrismaClient;
}

/** The real Express app wired with a test configuration (overrides use env variable names). */
export function createTestApp(
  overrides: Record<string, string | undefined> = {},
  { prisma }: TestAppOptions = {},
): { app: Express; config: Config } {
  const config = createTestConfig(overrides);
  const app = createApp({
    config,
    logger: createLogger(config),
    prisma: prisma ?? getPrisma(config.database.url),
  });
  return { app, config };
}
