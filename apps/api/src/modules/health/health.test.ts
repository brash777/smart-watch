import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import packageJson from '../../../package.json' with { type: 'json' };
import { createTestApp } from '../../../test/test-app';

const healthResponseSchema = z.object({
  data: z.object({
    status: z.literal('ok'),
    appName: z.string(),
    uptime: z.number().int().nonnegative(),
    version: z.string(),
  }),
});

describe('GET /api/health', () => {
  it('returns 200 with the status, the app name from the config, the uptime and the version', async () => {
    const { app } = createTestApp({ APP_NAME: 'Snapia Health Test' });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    const { data } = healthResponseSchema.parse(response.body);
    expect(data.appName).toBe('Snapia Health Test');
    expect(data.version).toBe(packageJson.version);
  });

  it('is public: it answers without any credentials', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
