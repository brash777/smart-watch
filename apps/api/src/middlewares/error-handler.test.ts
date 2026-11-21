import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readError } from '../../test/http';
import { createTestConfig } from '../../test/test-config';
import { AppError } from '../lib/app-error';
import { createLogger } from '../lib/logger';
import { createErrorHandler } from './error-handler';

/** A small app whose routes throw each kind of error. */
function createAppThatFails(isProduction: boolean): express.Express {
  const app = express();
  app.use(pinoHttp({ logger: createLogger(createTestConfig()) }));

  app.get('/zod', () => {
    z.object({ title: z.string() }).parse({ title: 42 });
  });
  app.get('/app-error', () => {
    throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404, { spaceId: 'abc' });
  });
  app.get('/crash', () => {
    throw new Error('connection to db-password-123 failed');
  });

  app.use(createErrorHandler({ isProduction }));
  return app;
}

describe('error handler', () => {
  it('turns a ZodError into 400 VALIDATION_ERROR with the issues', async () => {
    const response = await request(createAppThatFails(true)).get('/zod');

    expect(response.status).toBe(400);
    expect(readError(response.body)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [{ path: 'title', message: expect.any(String) as string, code: 'invalid_type' }],
    });
  });

  it('uses the status, code, message and details of an AppError', async () => {
    const response = await request(createAppThatFails(true)).get('/app-error');

    expect(response.status).toBe(404);
    expect(readError(response.body)).toEqual({
      code: 'SPACE_NOT_FOUND',
      message: 'Space not found',
      details: { spaceId: 'abc' },
    });
  });

  it('hides the details of unexpected errors in production', async () => {
    const response = await request(createAppThatFails(true)).get('/crash');

    expect(response.status).toBe(500);
    expect(readError(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
    });
    expect(response.text).not.toContain('db-password-123');
  });

  it('shows the details of unexpected errors outside production', async () => {
    const response = await request(createAppThatFails(false)).get('/crash');

    expect(response.status).toBe(500);
    expect(readError(response.body).details).toMatchObject({
      name: 'Error',
      message: 'connection to db-password-123 failed',
    });
  });
});
